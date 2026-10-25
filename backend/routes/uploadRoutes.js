const express = require('express');
const router = express.Router();
const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');
const path = require('path');

const { cloudinary } = require('../config/cloudinary');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Use memoryStorage so we can read the buffer for magic-byte detection before uploading
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

async function uploadBufferToCloudinary(buffer, originalname, mimetype) {
  const isPdf = mimetype === 'application/pdf';
  const ext = path.extname(originalname);
  const nameWithoutExt = path.basename(originalname, ext);
  const uniqueName = `${Date.now()}-${nameWithoutExt}${ext}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'skillsphere/uploads',
        resource_type: isPdf ? 'raw' : 'image',
        public_id: isPdf ? uniqueName : undefined,
        allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// Upload single file
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    console.log('📤 File upload request received');

    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Magic-byte detection (SS-C2)
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname, detected.mime);
    const fileUrl = result.secure_url;

    console.log('✅ File uploaded successfully:');
    console.log('   - Original name:', req.file.originalname);
    console.log('   - URL:', fileUrl);
    console.log('   - Size:', req.file.size, 'bytes');
    console.log('   - Type:', detected.mime);
    console.log('   - Storage: Cloudinary');

    res.json({
      success: true,
      file: {
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: detected.mime
      }
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Upload multiple files
router.post('/files', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    for (const file of req.files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        return res.status(400).json({ error: `File type not allowed: ${file.originalname}` });
      }
      const result = await uploadBufferToCloudinary(file.buffer, file.originalname, detected.mime);
      uploadedFiles.push({
        url: result.secure_url,
        filename: file.originalname,
        size: file.size,
        mimetype: detected.mime
      });
    }

    console.log(`✅ ${uploadedFiles.length} files uploaded (Cloudinary)`);

    res.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

module.exports = router;
