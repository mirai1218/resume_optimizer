const multer = require('multer');
const fs = require('fs');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  // GET — debug info or serve file
  if (req.method === 'GET') {
    const fileName = req.query.file;
    if (fileName) {
      const filePath = path.join('/tmp/uploads', path.basename(fileName));
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found', path: filePath });
      const ext = path.extname(filePath);
      const mimeMap = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
      res.setHeader('Content-Type', mimeMap[ext.toLowerCase()] || 'application/octet-stream');
      return fs.createReadStream(filePath).pipe(res);
    }
    return res.json({ status: 'ok', method: 'GET', hint: 'POST multipart/form-data with field "resume" to upload' });
  }

  // POST — upload and parse
  if (req.method === 'POST') {
    return new Promise((resolve) => {
      upload.single('resume')(req, res, async (multerErr) => {
        if (multerErr) {
          res.status(400).json({ error: 'Multer error: ' + multerErr.message, code: multerErr.code });
          return resolve();
        }

        if (!req.file) {
          res.status(400).json({
            error: 'No file received',
            hint: 'Send as multipart/form-data with field name "resume"',
            contentType: req.headers['content-type'] || 'not set',
          });
          return resolve();
        }

        const { buffer, mimetype, originalname } = req.file;

        try {
          let text = null;

          if (mimetype === 'application/pdf') {
            const pdfParse = require('pdf-parse');
            const result = await pdfParse(buffer);
            text = result.text;
          } else if (
            mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mimetype === 'application/msword'
          ) {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
          } else {
            res.status(400).json({ error: 'Unsupported file type: ' + mimetype });
            return resolve();
          }

          if (!text || text.trim().length === 0) {
            res.status(400).json({ error: 'Extracted text is empty', mimetype });
            return resolve();
          }

          // Save to /tmp
          const uploadsDir = '/tmp/uploads';
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          const ext = path.extname(originalname);
          const savedName = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
          fs.writeFileSync(path.join(uploadsDir, savedName), buffer);

          res.json({ success: true, text, fileName: originalname, fileUrl: '/api/resume?file=' + savedName });
          return resolve();
        } catch (parseErr) {
          res.status(500).json({
            error: 'Parse failed: ' + parseErr.message,
            stack: parseErr.stack,
            mimetype,
          });
          return resolve();
        }
      });
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
