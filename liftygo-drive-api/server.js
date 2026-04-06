'use strict';

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { google } = require('googleapis');

const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * העלאת קובץ בינארי ללא multipart של googleapis (שם מסלול pipe שבור עם חלק מהזרמים).
 * Resumable: POST לאתחול + PUT של Buffer — תואם Drive API v3.
 */
async function uploadFileResumable(auth, folderId, name, mimeType, buffer) {
  const client = await auth.getClient();
  const authHeaders = await client.getRequestHeaders(DRIVE_UPLOAD_BASE);
  const buf = Buffer.from(buffer);
  const mime = mimeType || 'image/jpeg';
  // מטא־דאטה בלבד; mime של הקובץ נשלח ב-X-Upload-Content-Type וב-PUT
  const meta = JSON.stringify({
    name,
    parents: [folderId],
  });

  const initUrl = `${DRIVE_UPLOAD_BASE}?uploadType=resumable&fields=id&supportsAllDrives=true`;
  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(buf.length),
    },
    body: meta,
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Drive resumable init ${initRes.status}: ${errText.slice(0, 800)}`);
  }

  const location = initRes.headers.get('Location') || initRes.headers.get('location');
  if (!location) {
    throw new Error('Drive resumable: missing Location header');
  }

  const putRes = await fetch(location, {
    method: 'PUT',
    headers: {
      ...authHeaders,
      'Content-Length': String(buf.length),
      'Content-Type': mime,
    },
    body: buf,
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`Drive resumable PUT ${putRes.status}: ${errText.slice(0, 800)}`);
  }

  const putText = await putRes.text();
  let data = {};
  try {
    data = putText ? JSON.parse(putText) : {};
  } catch (_e) {
    throw new Error(`Drive resumable PUT: expected JSON, got: ${putText.slice(0, 200)}`);
  }
  if (!data.id) {
    throw new Error('Drive resumable PUT: missing id in response');
  }
  return data.id;
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
        const fileId = await uploadFileResumable(auth, folderId, name, mime, f.buffer);
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
