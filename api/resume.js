import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const config = { api: { bodyParser: false } };

function getMimeType(ext) {
  const map = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

async function parseFile(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    return (await pdfParse(buffer)).text;
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimetype === 'application/msword') {
    return (await mammoth.extractRawText({ buffer })).value;
  }
  return null;
}

export default async function handler(req, res) {
  // GET — serve uploaded file
  if (req.method === 'GET') {
    const fileName = req.query.file;
    if (!fileName) return res.status(400).json({ error: 'Missing file name' });

    const uploadsDir = '/tmp/uploads';
    const filePath = path.join(uploadsDir, path.basename(fileName));

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    const ext = path.extname(filePath);
    res.setHeader('Content-Type', getMimeType(ext));
    return fs.createReadStream(filePath).pipe(res);
  }

  // POST — upload and parse file
  if (req.method === 'POST') {
    return new Promise((resolve) => {
      upload.single('resume')(req, res, async (err) => {
        if (err) {
          res.status(400).json({ error: err.message });
          return resolve();
        }

        if (!req.file) {
          res.status(400).json({ error: 'No file uploaded' });
          return resolve();
        }

        const text = await parseFile(req.file.buffer, req.file.mimetype);
        if (text === null) {
          res.status(400).json({ error: 'Unsupported file type' });
          return resolve();
        }

        // Save to /tmp
        const uploadsDir = '/tmp/uploads';
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const ext = path.extname(req.file.originalname);
        const savedName = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
        fs.writeFileSync(path.join(uploadsDir, savedName), req.file.buffer);

        res.json({
          success: true,
          text,
          fileName: req.file.originalname,
          fileUrl: '/api/resume?file=' + savedName,
        });
        return resolve();
      });
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
