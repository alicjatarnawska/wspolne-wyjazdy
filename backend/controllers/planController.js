const pool = require('../config/db');

// sprawdzenie, czy ciąg "YYYY-MM-DD" jest poprawną datą kalendarzową
const isValidDateString = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

// wspólna walidacja pól aktywności (dodawanie i edycja punktów harmonogramu)
const validatePlanItemData = ({ date, time, title, description }) => {
  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'Tytuł aktywności jest wymagany.' };
  }
  if (title.trim().length > 150) {
    return { error: 'Tytuł aktywności może mieć maksymalnie 150 znaków.' };
  }

  if (!isValidDateString(date)) {
    return { error: 'Podaj poprawną datę w formacie RRRR-MM-DD.' };
  }

  let normalizedTime = null;
  if (time !== undefined && time !== null && time !== '') {
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(time.trim())) {
      return { error: 'Podaj poprawną godzinę w formacie GG:MM.' };
    }
    normalizedTime = time.trim().slice(0, 5);
  }

  let normalizedDescription = null;
  if (description !== undefined && description !== null && description !== '') {
    if (typeof description !== 'string') {
      return { error: 'Opis aktywności musi być tekstem.' };
    }
    normalizedDescription = description.trim() || null;
  }

  return {
    data: {
      date,
      time: normalizedTime,
      title: title.trim(),
      description: normalizedDescription,
    },
  };
};

// pobranie zakresu dat wyjazdu oraz roli zalogowanego użytkownika
const getTripWithRole = async (tripId, userId) => {
  const result = await pool.query(
    `SELECT t.start_date, t.end_date, tm.role AS my_role
     FROM trips t
     LEFT JOIN trip_members tm
       ON t.id = tm.trip_id AND tm.user_id = $2
     WHERE t.id = $1`,
    [tripId, userId]
  );
  return result.rows[0] || null;
};

// POBRANIE HARMONOGRAMU WYJAZDU
// GET /api/trips/:tripId/plan
exports.getTripPlan = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const userId = req.user.id;

  if (!Number.isInteger(tripId) || tripId <= 0) {
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

    // punkty bez godziny (NULL) wyświetlają się na górze danego dnia
    const planResult = await pool.query(
      `SELECT
         id,
         trip_id,
         date,
         LEFT(time::text, 5) AS time,
         title,
         description
       FROM plan_items
       WHERE trip_id = $1
       ORDER BY date ASC, time ASC NULLS FIRST, id ASC`,
      [tripId]
    );

    res.status(200).json({
      my_role: trip.my_role,
      items: planResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania harmonogramu.' });
  }
};

// DODANIE NOWEJ AKTYWNOŚCI DO HARMONOGRAMU
// POST /api/trips/:tripId/plan
exports.addPlanItem = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const userId = req.user.id;

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  const { error, data } = validatePlanItemData(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    if (data.date < trip.start_date || data.date > trip.end_date) {
      return res.status(400).json({
        error: `Data aktywności musi mieścić się w terminie wyjazdu (${trip.start_date} – ${trip.end_date}).`,
      });
    }

    const insertResult = await pool.query(
      `INSERT INTO plan_items (trip_id, date, time, title, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, trip_id, date, LEFT(time::text, 5) AS time, title, description`,
      [tripId, data.date, data.time, data.title, data.description]
    );

    res.status(201).json({
      message: 'Aktywność została dodana do harmonogramu.',
      item: insertResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas dodawania aktywności.' });
  }
};

// EDYCJA AKTYWNOŚCI (data, godzina, tytuł, opis)
// PATCH /api/trips/:tripId/plan/:itemId
exports.updatePlanItem = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const itemId = Number(req.params.itemId);
  const userId = req.user.id;

  if (!Number.isInteger(tripId) || tripId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub aktywności.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    // pobranie obecnego stanu aktywności
    const existingResult = await pool.query(
      `SELECT id, date, LEFT(time::text, 5) AS time, title, description
       FROM plan_items
       WHERE id = $1 AND trip_id = $2`,
      [itemId, tripId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono aktywności w tym wyjeździe.' });
    }

    const current = existingResult.rows[0];
    const mergedInput = {
      date: req.body.date !== undefined ? req.body.date : current.date,
      time: req.body.time !== undefined ? req.body.time : current.time,
      title: req.body.title !== undefined ? req.body.title : current.title,
      description: req.body.description !== undefined ? req.body.description : current.description,
    };

    const { error, data } = validatePlanItemData(mergedInput);
    if (error) {
      return res.status(400).json({ error });
    }

    if (data.date < trip.start_date || data.date > trip.end_date) {
      return res.status(400).json({
        error: `Data aktywności musi mieścić się w terminie wyjazdu (${trip.start_date} – ${trip.end_date}).`,
      });
    }

    const updateResult = await pool.query(
      `UPDATE plan_items
       SET date = $1, time = $2, title = $3, description = $4
       WHERE id = $5 AND trip_id = $6
       RETURNING id, trip_id, date, LEFT(time::text, 5) AS time, title, description`,
      [data.date, data.time, data.title, data.description, itemId, tripId]
    );

    res.status(200).json({
      message: 'Aktywność została zaktualizowana.',
      item: updateResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas aktualizacji aktywności.' });
  }
};

// USUNIĘCIE AKTYWNOŚCI Z HARMONOGRAMU
// DELETE /api/trips/:tripId/plan/:itemId
exports.deletePlanItem = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const itemId = Number(req.params.itemId);
  const userId = req.user.id;

  if (!Number.isInteger(tripId) || tripId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub aktywności.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const deleteResult = await pool.query(
      `DELETE FROM plan_items
       WHERE id = $1 AND trip_id = $2
       RETURNING id`,
      [itemId, tripId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono aktywności w tym wyjeździe.' });
    }

    res.status(200).json({
      message: 'Aktywność została usunięta z harmonogramu.',
      deletedId: itemId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania aktywności.' });
  }
};