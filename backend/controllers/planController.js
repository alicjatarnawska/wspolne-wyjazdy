const pool = require('../config/db');
const {
  parsePositiveInt,
  isValidDateString,
  validateTextField,
} = require('../utils/validators');
const { getTripWithRole } = require('../utils/tripHelpers');

// Wspólna walidacja pól aktywności (dodawanie i edycja punktów harmonogramu)
const validatePlanItemData = ({ date, time, title, description }) => {
  const titleCheck = validateTextField(title, {
    requiredMsg: 'Tytuł aktywności jest wymagany.',
    maxLength: 150,
    maxLengthMsg: 'Tytuł aktywności może mieć maksymalnie 150 znaków.',
    xssMsg: 'Tytuł aktywności nie może zawierać niebezpiecznego kodu HTML ani skryptów.',
  });
  if (titleCheck.error) return { error: titleCheck.error };

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

  const descCheck = validateTextField(description, {
    required: false,
    typeMsg: 'Opis aktywności musi być tekstem.',
    maxLength: 500,
    maxLengthMsg: 'Opis aktywności może mieć maksymalnie 500 znaków.',
    xssMsg: 'Opis aktywności nie może zawierać niebezpiecznego kodu HTML ani skryptów.',
  });
  if (descCheck.error) return { error: descCheck.error };

  return {
    data: {
      date,
      time: normalizedTime,
      title: titleCheck.value,
      description: descCheck.value,
    },
  };
};

// POBRANIE HARMONOGRAMU WYJAZDU
// GET /api/trips/:tripId/plan
exports.getTripPlan = async (req, res) => {
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
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  const { error, data } = validatePlanItemData(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const trip = await getTripWithRole(tripId, userId, 't.start_date, t.end_date');

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
  const tripId = parsePositiveInt(req.params.tripId);
  const itemId = parsePositiveInt(req.params.itemId);
  const userId = req.user.id;

  if (!tripId || !itemId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub aktywności.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId, 't.start_date, t.end_date');

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

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
  const tripId = parsePositiveInt(req.params.tripId);
  const itemId = parsePositiveInt(req.params.itemId);
  const userId = req.user.id;

  if (!tripId || !itemId) {
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