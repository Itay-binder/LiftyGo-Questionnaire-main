'use strict';

const { Readable } = require('stream');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { google } = require('googleapis');

/**
 * העלאה דרך googleapis (media multipart) — Readable.from(Buffer) יציב ב-Node 20,
 * לעומת resumable+fetch שלפעמים נכשל (PUT / סשן / כותרות).
 */
async function uploadFileViaDriveCreate(drive, folderId, name, mimeType, buffer) {
  const buf = Buffer.from(buffer);
  const mime = mimeType || 'image/jpeg';
  const body = Readable.from(buf);
  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
    },
    media: {
      mimeType: mime,
      body,
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  if (!res.data || !res.data.id) {
    throw new Error('Drive files.create: missing id in response');
  }
  return res.data.id;
}

/** שם קובץ בטוח ASCII ל-Drive (שמות עבריים לפעמים גורמים לבעיות במטא־דאטה אצל לקוחות מסוימים) */
function safeFileName(name) {
  const base = (name || 'image.jpg').toString().replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim() || 'image.jpg';
  return base.slice(0, 200);
}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 40 },
});

const MAX_FIELD = 500;

function parseOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : true;
}

app.use(cors({ origin: parseOrigins(), credentials: false }));

app.get('/', (_req, res) => {
  res.status(200).type('text/plain').send('liftygo-drive-api — use GET /health or POST /upload');
});

app.get('/health', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

// גלישה בדפדפן = GET — לא שגיאת שרת, פשוט אין כאן דף. העלאה = POST מmultipart מהטופס.
app.get('/upload', (_req, res) => {
  res.status(200).json({
    ok: true,
    hint: 'This URL is for POST (multipart) from the questionnaire, not for opening in a browser.',
    method: 'POST',
    fields: ['customer_name', 'order_date'],
    file_field: 'files',
  });
});

app.post('/upload', upload.array('files', 40), async (req, res) => {
  try {
    const apiKey = process.env.UPLOAD_API_KEY || '';
    if (apiKey && (req.get('x-api-key') || '') !== apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files' });
    }
    for (const f of files) {
      const sz = f.buffer ? f.buffer.length : 0;
      if (!sz) {
        console.error('Reject upload: empty file buffer', f.originalname, f.mimetype);
        return res.status(400).json({ error: 'Empty file upload', name: f.originalname || '' });
      }
    }

    const customerName = String(req.body.customer_name || 'לקוח').slice(0, MAX_FIELD);
    const orderDate = String(req.body.order_date || '').slice(0, 32);

    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
      console.error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    let credentials;
    try {
      credentials = JSON.parse(saJson);
    } catch (_e) {
      return res.status(500).json({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const parentId = (process.env.DRIVE_PARENT_FOLDER_ID || '').trim();
    const folderName = `${customerName}_${orderDate || 'no-date'}_${Date.now()}`.slice(0, 200);

    const folderMeta = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      folderMeta.parents = [parentId];
    }

    const driveOpts = { supportsAllDrives: true };

    const folder = await drive.files.create({
      requestBody: folderMeta,
      fields: 'id',
      ...driveOpts,
    });
    const folderId = folder.data.id;

    const uploadedFileIds = [];
    const fileErrors = [];

    for (const f of files) {
      const mime = (f.mimetype || 'image/jpeg').toString();
      const name = safeFileName(f.originalname || 'image.jpg');
      try {
        const fileId = await uploadFileViaDriveCreate(drive, folderId, name, mime, f.buffer);
        if (fileId) uploadedFileIds.push(fileId);
      } catch (fileErr) {
        const msg = fileErr.message || String(fileErr);
        console.error('Drive upload failed:', name, f.buffer ? f.buffer.length : 0, 'bytes', msg);
        fileErrors.push({ name, error: msg, details: null });
      }
    }

    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    if (uploadedFileIds.length === 0) {
      // לא מוחקים תיקייה — כדי שתוכל לראות בדרייב מה קרה + לוגים ב־Cloud Run
      console.error('Drive: folder kept (uploads failed)', folderId, JSON.stringify(fileErrors));
      return res.status(500).json({
        error: 'No files could be uploaded to Drive',
        folder_id: folderId,
        folder_url: folderUrl,
        folder_name: folderName,
        file_errors: fileErrors,
      });
    }

    return res.json({
      success: true,
      folder_id: folderId,
      folder_url: folderUrl,
      files_count: uploadedFileIds.length,
      folder_name: folderName,
      failed_count: fileErrors.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`liftygo-drive-api listening on ${PORT}`);
});
