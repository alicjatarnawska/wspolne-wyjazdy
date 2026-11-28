const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join('uploads', 'trips');
const MAX_FILE_SIZE_BYTES = 10485760; // dokładnie 10 MB (zgodnie z CHECK w tabeli files)

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Mapowanie dozwolonych typów MIME na wartości kolumn 'file_type' oraz 'category'
const MIME_TO_FILE_META = {
  'application/pdf': { fileType: 'PDF', category: 'DOCUMENT', defaultExt: '.pdf' },
  'image/jpeg': { fileType: 'JPG', category: 'PHOTO', defaultExt: '.jpg' },
  'image/png': { fileType: 'PNG', category: 'PHOTO', defaultExt: '.png' },
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const meta = MIME_TO_FILE_META[file.mimetype];
    const ext = meta ? meta.defaultExt : path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (MIME_TO_FILE_META[file.mimetype]) {
    return cb(null, true);
  }
  const err = new Error('Niedozwolony format pliku. Akceptowane są wyłącznie pliki PDF, JPG oraz PNG.');
  err.code = 'INVALID_FILE_TYPE';
  return cb(err, false);
};

const uploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10,
  },
});

const handleTripFilesUpload = (req, res, next) => {
  uploader.array('files', 10)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Maksymalny rozmiar pojedynczego pliku to 10 MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Możesz przesłać maksymalnie 10 plików jednocześnie.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Nieprawidłowa nazwa pola formularza (oczekiwano pola "files").' });
      }
      return res.status(400).json({ error: 'Błąd podczas przesyłania plików.' });
    }

    if (err.code === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: 'Błąd serwera podczas odbierania plików.' });
  });
};

module.exports = {
  handleTripFilesUpload,
  MIME_TO_FILE_META,
  MAX_FILE_SIZE_BYTES,
};