const pool = require('../config/db');
const fs = require('fs/promises');
const path = require('path');
const { parsePositiveInt, containsScriptOrHtml } = require('../utils/validators');
const { getTripWithRole } = require('../utils/tripHelpers');
const { ALLOWED_PHOTO_MIMES } = require('../middleware/uploadMiddleware');

// dekodowanie polskich znaków w nazwie pliku 
const normalizeOriginalName = (rawName) => {
  let decoded = rawName;
  const isLatin1Bytes = [...rawName].every((ch) => ch.charCodeAt(0) <= 255);
  if (isLatin1Bytes) {
    const candidate = Buffer.from(rawName, 'latin1').toString('utf8');
    if (!candidate.includes('\uFFFD')) {
      decoded = candidate;
    }
  }
  return decoded.replace(/[\r\n\0]/g, '').trim();
};

// usunięcie przesłanych plików z dysku (np. w razie błędu walidacji lub zapisu do postgresa)
const cleanupUploadedFiles = async (files = []) => {
  if (files.length === 0) return;
  await Promise.allSettled(files.map((f) => fs.unlink(f.path)));
};

// middleware sprawdzający dostęp do wyjazdu PRZED zapisem plików na dysk
exports.verifyTripMembership = async (req, res, next) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    req.tripRole = trip.my_role;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Błąd serwera podczas weryfikacji dostępu do wyjazdu.' });
  }
};

// POBRANIE LISTY PLIKÓW WYJAZDU (DOKUMENTY I GALERIA ZDJĘĆ)
// GET /api/trips/:tripId/files?category=PHOTO|DOCUMENT
exports.getTripFiles = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;
  const { category } = req.query;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  if (category !== undefined && category !== 'DOCUMENT' && category !== 'PHOTO') {
    return res.status(400).json({
      error: 'Nieprawidłowa kategoria pliku. Dozwolone wartości: DOCUMENT lub PHOTO.',
    });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const params = [tripId];
    let categoryFilter = '';
    if (category) {
      params.push(category);
      categoryFilter = 'AND f.category = $2';
    }

    const filesResult = await pool.query(
      `SELECT
         f.id,
         f.trip_id,
         f.uploaded_by_user_id,
         u.display_name AS uploaded_by_name,
         u.email AS uploaded_by_email,
         f.original_name,
         f.mime_type,
         f.size,
         f.category,
         f.created_at
       FROM files f
       LEFT JOIN users u ON f.uploaded_by_user_id = u.id
       WHERE f.trip_id = $1 ${categoryFilter}
       ORDER BY f.created_at DESC, f.id DESC`,
      params
    );

    const files = filesResult.rows;

    res.status(200).json({
      my_role: trip.my_role,
      files,
      documents: files.filter((f) => f.category === 'DOCUMENT'),
      photos: files.filter((f) => f.category === 'PHOTO'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania listy plików.' });
  }
};

// DODANIE PLIKÓW (DOKUMENTÓW LUB ZDJĘĆ DO GALERII)
// POST /api/trips/:tripId/files
exports.uploadTripFiles = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;
  const uploadedFiles = req.files || [];

  if (uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'Wybierz co najmniej jeden plik do przesłania.' });
  }

  // opcjonalne wymuszenie kategorii z formularza
  const requestedCategory = req.body?.category;
  if (
    requestedCategory !== undefined &&
    requestedCategory !== '' &&
    requestedCategory !== 'DOCUMENT' &&
    requestedCategory !== 'PHOTO'
  ) {
    await cleanupUploadedFiles(uploadedFiles);
    return res.status(400).json({
      error: 'Nieprawidłowa kategoria pliku. Dozwolone wartości: DOCUMENT lub PHOTO.',
    });
  }

  // walidacja nazw plików i zgodności kategorii z typem
  const preparedFiles = [];
  for (const file of uploadedFiles) {
    const cleanName = normalizeOriginalName(file.originalname);

    if (!cleanName || cleanName.length > 255) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        error: 'Nazwa pliku jest nieprawidłowa lub przekracza 255 znaków.',
      });
    }

    if (containsScriptOrHtml(cleanName)) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        error: 'Nazwa pliku nie może zawierać niebezpiecznego kodu HTML ani skryptów.',
      });
    }

    const detectedCategory = ALLOWED_PHOTO_MIMES.has(file.mimetype) ? 'PHOTO' : 'DOCUMENT';

    if (requestedCategory && requestedCategory !== detectedCategory) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        error:
          requestedCategory === 'PHOTO'
            ? 'Do galerii zdjęć można dodawać wyłącznie pliki graficzne (JPG, PNG, WEBP, GIF).'
            : 'Wybrany plik jest zdjęciem, a nie dokumentem.',
      });
    }

    preparedFiles.push({
      original_name: cleanName,
      path: file.path,
      mime_type: file.mimetype,
      size: file.size,
      category: detectedCategory,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertedRecords = [];
    for (const item of preparedFiles) {
      const insertResult = await client.query(
        `INSERT INTO files (trip_id, uploaded_by_user_id, original_name, path, mime_type, size, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, trip_id, uploaded_by_user_id, original_name, mime_type, size, category, created_at`,
        [
          tripId,
          userId,
          item.original_name,
          item.path,
          item.mime_type,
          item.size,
          item.category,
        ]
      );

      insertedRecords.push({
        ...insertResult.rows[0],
        uploaded_by_name: req.user.display_name || null,
        uploaded_by_email: req.user.email || null,
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      message:
        insertedRecords.length === 1
          ? 'Plik został przesłany.'
          : `Przesłano plików: ${insertedRecords.length}.`,
      files: insertedRecords,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    await cleanupUploadedFiles(uploadedFiles);
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas zapisywania plików.' });
  } finally {
    client.release();
  }
};

// POBIERANIE LUB PODGLĄD PLIKU (PO WERYFIKACJI CZŁONKOSTWA W WYJEŹDZIE)
// GET /api/trips/:tripId/files/:fileId/download?inline=true
exports.downloadTripFile = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const fileId = parsePositiveInt(req.params.fileId);
  const userId = req.user.id;

  if (!tripId || !fileId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub pliku.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const fileResult = await pool.query(
      `SELECT id, original_name, path, mime_type
       FROM files
       WHERE id = $1 AND trip_id = $2`,
      [fileId, tripId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono pliku w tym wyjeździe.' });
    }

    const file = fileResult.rows[0];
    const absolutePath = path.resolve(file.path);

    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ error: 'Plik nie istnieje na dysku serwera.' });
    }

    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // tryb podglądu (np. wyświetlanie zdjęć w galerii \ podgląd PDF w przeglądarce) lub pobieranie na dysk
    if (req.query.inline === 'true' || req.query.inline === '1') {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`
      );
      return res.sendFile(absolutePath);
    }

    return res.download(absolutePath, file.original_name);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania pliku.' });
  }
};

// USUNIĘCIE PLIKU Z BAZY ORAZ Z DYSKU SERWERA
// DELETE /api/trips/:tripId/files/:fileId
exports.deleteTripFile = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const fileId = parsePositiveInt(req.params.fileId);
  const userId = req.user.id;

  if (!tripId || !fileId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub pliku.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const fileResult = await pool.query(
      `SELECT id, uploaded_by_user_id, path
       FROM files
       WHERE id = $1 AND trip_id = $2`,
      [fileId, tripId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono pliku w tym wyjeździe.' });
    }

    const file = fileResult.rows[0];

    // usunąć może osoba, która dodała plik albo organizator wyjazdu
    if (file.uploaded_by_user_id !== userId && trip.my_role !== 'ORGANIZER') {
      return res.status(403).json({
        error: 'Tylko autor pliku lub organizator wyjazdu może go usunąć.',
      });
    }

    await pool.query(
      'DELETE FROM files WHERE id = $1 AND trip_id = $2',
      [fileId, tripId]
    );

    await fs.unlink(file.path).catch(() => {});

    res.status(200).json({
      message: 'Plik został usunięty.',
      deletedId: fileId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania pliku.' });
  }
};