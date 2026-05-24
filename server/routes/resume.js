import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const uploadsDir = path.join(__dirname, '..', 'uploads');

router.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileType = req.file.mimetype;
    let text = '';

    if (fileType === 'application/pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      text = pdfData.text;
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Save original file to disk
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const fileExt = path.extname(req.file.originalname);
    const savedName = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + fileExt;
    fs.writeFileSync(path.join(uploadsDir, savedName), req.file.buffer);

    const fileUrl = '/uploads/' + savedName;

    res.json({ success: true, text, fileName: req.file.originalname, fileUrl });
  } catch (error) {
    console.error('File parse error:', error);
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

router.post('/parse-text', (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'No content provided' });
  }
  res.json({ success: true, text: content });
});

export default router;
