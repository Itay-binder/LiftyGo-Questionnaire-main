'use strict';

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { google } = require('googleapis');
const { Readable } = require('stream');

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

    const folder = await drive.files.create({
      requestBody: folderMeta,
      fields: 'id',
    });
    const folderId = folder.data.id;

    for (const f of files) {
      const mime = f.mimetype || 'image/jpeg';
      await drive.files.create({
        requestBody: {
          name: (f.originalname || 'image.jpg').toString().slice(0, 200),
          parents: [folderId],
        },
        media: {
          mimeType: mime,
          body: Readable.from(f.buffer),
        },
        fields: 'id',
      });
    }

    return res.json({
      success: true,
      folder_id: folderId,
      folder_url: `https://drive.google.com/drive/folders/${folderId}`,
      files_count: files.length,
      folder_name: folderName,
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
