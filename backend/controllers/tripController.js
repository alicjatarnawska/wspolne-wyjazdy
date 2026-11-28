const pool = require('../config/db');
const fs = require('fs/promises');
const {
  parsePositiveInt,
  normalizeAndValidateEmail,
  validateTextField,
} = require('../utils/validators');
const { getTripWithRole, getTripMembersList } = require('../utils/tripHelpers');

// wspólna walidacja pól wyjazdu dla tworzenia oraz edycji wyjazdu
const validateTripData = ({ name, destination, start_date, end_date, description }) => {
  if (
    typeof name !== 'string' || !name.trim() ||
    typeof destination !== 'string' || !destination.trim() ||
    !start_date || !end_date
  ) {
    return {
      error: 'Nazwa, miejsce docelowe, data rozpoczęcia i zakończenia są wymagane.',
    };
  }

  const nameCheck = validateTextField(name, {
    requiredMsg: 'Nazwa wyjazdu jest wymagana.',
    maxLength: 100,
    maxLengthMsg: 'Nazwa wyjazdu może mieć maksymalnie 100 znaków.',
    xssMsg: 'Nazwa oraz miejsce docelowe nie mogą zawierać niebezpiecznego kodu HTML ani skryptów.',
  });
  if (nameCheck.error) return { error: nameCheck.error };

  const destCheck = validateTextField(destination, {
    requiredMsg: 'Miejsce docelowe jest wymagane.',
    maxLength: 100,
    maxLengthMsg: 'Miejsce docelowe może mieć maksymalnie 100 znaków.',
    xssMsg: 'Nazwa oraz miejsce docelowe nie mogą zawierać niebezpiecznego kodu HTML ani skryptów.',
  });
  if (destCheck.error) return { error: destCheck.error };

  if (end_date < start_date) {
    return { error: 'Data zakończenia wyjazdu nie może być wcześniejsza niż data rozpoczęcia.' };
  }

  const descCheck = validateTextField(description, {
    required: false,
    typeMsg: 'Opis wyjazdu musi być tekstem.',
    maxLength: 500,
    maxLengthMsg: 'Opis wyjazdu może mieć maksymalnie 500 znaków.',
    xssMsg: 'Opis wyjazdu nie może zawierać niebezpiecznego kodu HTML ani skryptów.',
  });
  if (descCheck.error) return { error: descCheck.error };

  return {
    data: {
      name: nameCheck.value,
      destination: destCheck.value,
      start_date,
      end_date,
      description: descCheck.value,
    },
  };
};

// TWORZENIE NOWEGO WYJAZDU
// POST /api/trips
exports.createTrip = async (req, res) => {
  const userId = req.user.id;

  const { error, data } = validateTripData(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tripResult = await client.query(
      `INSERT INTO trips (name, destination, start_date, end_date, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.destination, data.start_date, data.end_date, data.description]
    );
    const newTrip = tripResult.rows[0];

    await client.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'ORGANIZER')`,
      [newTrip.id, userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Wyjazd został utworzony.',
      trip: { ...newTrip, role: 'ORGANIZER' },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23514') {
      return res.status(400).json({
        error: 'Data zakończenia wyjazdu nie może być wcześniejsza niż data rozpoczęcia.',
      });
    }
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({
        error: 'Nieprawidłowy format daty rozpoczęcia lub zakończenia wyjazdu.',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Nie udało się utworzyć wyjazdu.' });
  } finally {
    client.release();
  }
};

// EDYCJA DANYCH WYJAZDU (tylko dla organizatora)
// PATCH /api/trips/:tripId
exports.updateTrip = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    const currentTrip = await getTripWithRole(tripId, userId, 't.*');

    if (!currentTrip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!currentTrip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }
    if (currentTrip.my_role !== 'ORGANIZER') {
      return res.status(403).json({ error: 'Tylko organizator wyjazdu może edytować jego dane.' });
    }

    const mergedInput = {
      name: req.body.name !== undefined ? req.body.name : currentTrip.name,
      destination: req.body.destination !== undefined ? req.body.destination : currentTrip.destination,
      start_date: req.body.start_date !== undefined ? req.body.start_date : currentTrip.start_date,
      end_date: req.body.end_date !== undefined ? req.body.end_date : currentTrip.end_date,
      description: req.body.description !== undefined ? req.body.description : currentTrip.description,
    };

    const { error, data } = validateTripData(mergedInput);
    if (error) {
      return res.status(400).json({ error });
    }

    // Ochrona spójności harmonogramu przed skróceniem terminu wyjazdu
    const outOfRangeItems = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM plan_items
       WHERE trip_id = $1 AND (date < $2 OR date > $3)`,
      [tripId, data.start_date, data.end_date]
    );

    if (outOfRangeItems.rows[0].count > 0) {
      return res.status(409).json({
        error: 'Nie można zmienić terminu wyjazdu, ponieważ w harmonogramie są aktywności poza nowym zakresem dat. Najpierw usuń je lub zmień ich datę.',
      });
    }

    const updateResult = await pool.query(
      `UPDATE trips
       SET name = $1, destination = $2, start_date = $3, end_date = $4, description = $5
       WHERE id = $6
       RETURNING *`,
      [data.name, data.destination, data.start_date, data.end_date, data.description, tripId]
    );

    res.status(200).json({
      message: 'Dane wyjazdu zostały zaktualizowane.',
      trip: {
        ...updateResult.rows[0],
        my_role: currentTrip.my_role,
      },
    });
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({
        error: 'Data zakończenia wyjazdu nie może być wcześniejsza niż data rozpoczęcia.',
      });
    }
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({
        error: 'Nieprawidłowy format daty rozpoczęcia lub zakończenia wyjazdu.',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas aktualizacji wyjazdu.' });
  }
};

// USUNIĘCIE UCZESTNIKA LUB SAMODZIELNE OPUSZCZENIE WYJAZDU
// DELETE /api/trips/:tripId/members/:userId (oraz /members/me)
exports.removeMember = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const requesterId = req.user.id;
  const targetUserId =
    req.params.userId === 'me' ? requesterId : parsePositiveInt(req.params.userId);

  if (!tripId || !targetUserId) {
    return res.status(400).json({
      error: 'Nieprawidłowy identyfikator wyjazdu lub użytkownika.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tripCheck = await client.query('SELECT id FROM trips WHERE id = $1', [tripId]);
    if (tripCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }

    const membersResult = await client.query(
      'SELECT user_id, role FROM trip_members WHERE trip_id = $1',
      [tripId]
    );
    const members = membersResult.rows;

    const requesterMember = members.find((m) => m.user_id === requesterId);
    if (!requesterMember) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const targetMember = members.find((m) => m.user_id === targetUserId);
    if (!targetMember) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ten użytkownik nie jest uczestnikiem tego wyjazdu.' });
    }

    const isSelfLeave = requesterId === targetUserId;

    if (!isSelfLeave && requesterMember.role !== 'ORGANIZER') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Tylko organizator wyjazdu może usuwać innych uczestników.',
      });
    }

    if (members.length === 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Jesteś jedynym uczestnikiem tego wyjazdu. Aby go zakończyć, usuń cały wyjazd.',
      });
    }

    const organizers = members.filter((m) => m.role === 'ORGANIZER');
    if (targetMember.role === 'ORGANIZER' && organizers.length <= 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Nie możesz opuścić wyjazdu jako jedyny organizator. Najpierw przekaż rolę organizatora innemu uczestnikowi.',
      });
    }

    // Odpięcie zadań odchodzącego uczestnika (stają się nieprzypisane)
    await client.query(
      `UPDATE tasks
       SET assigned_user_id = NULL
       WHERE trip_id = $1 AND assigned_user_id = $2`,
      [tripId, targetUserId]
    );

    await client.query(
      'DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2',
      [tripId, targetUserId]
    );

    await client.query('COMMIT');

    res.status(200).json({
      message: isSelfLeave ? 'Opuszczono wyjazd.' : 'Uczestnik został usunięty z wyjazdu.',
      removedUserId: targetUserId,
      leftTrip: isSelfLeave,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania uczestnika z wyjazdu.' });
  } finally {
    client.release();
  }
};

// USUNIĘCIE WYJAZDU WRAZ ZE WSZYSTKIMI POWIĄZANYMI DANYMI (tylko dla organizatora)
// DELETE /api/trips/:tripId
exports.deleteTrip = async (req, res) => {
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
    if (trip.my_role !== 'ORGANIZER') {
      return res.status(403).json({ error: 'Tylko organizator wyjazdu może go usunąć.' });
    }

    const filesResult = await pool.query(
      'SELECT path FROM files WHERE trip_id = $1',
      [tripId]
    );

    await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);

    if (filesResult.rows.length > 0) {
      await Promise.allSettled(
        filesResult.rows.map((file) => fs.unlink(file.path))
      );
    }

    res.status(200).json({
      message: 'Wyjazd został trwale usunięty.',
      deletedId: tripId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania wyjazdu.' });
  }
};

// POBRANIE LISTY WYJAZDÓW UŻYTKOWNIKA
// GET /api/trips
exports.getUserTrips = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT t.*, tm.role, tm.joined_at
       FROM trips t
       JOIN trip_members tm ON t.id = tm.trip_id
       WHERE tm.user_id = $1
       ORDER BY t.start_date ASC`,
      [userId]
    );

    res.status(200).json({ trips: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Nie udało się pobrać listy wyjazdów.' });
  }
};

// DODAWANIE NOWEGO UCZESTNIKA DO WYJAZDU (tylko dla organizatora)
// POST /api/trips/:tripId/members
exports.inviteMember = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const requesterId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  const emailCheck = normalizeAndValidateEmail(
    req.body.email,
    'Podaj adres e-mail zapraszanego użytkownika.'
  );
  if (emailCheck.error) {
    return res.status(400).json({ error: emailCheck.error });
  }

  try {
    const trip = await getTripWithRole(tripId, requesterId);
    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (trip.my_role !== 'ORGANIZER') {
      return res.status(403).json({
        error: 'Tylko organizator wyjazdu może dodawać nowych uczestników.',
      });
    }

    const userResult = await pool.query(
      'SELECT id, email, display_name FROM users WHERE email = $1',
      [emailCheck.value]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Nie znaleziono konta powiązanego z podanym adresem e-mail.',
      });
    }

    const invitedUser = userResult.rows[0];

    await pool.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'PARTICIPANT')`,
      [tripId, invitedUser.id]
    );

    res.status(201).json({
      message: 'Uczestnik został dodany do wyjazdu.',
      member: {
        id: invitedUser.id,
        email: invitedUser.email,
        display_name: invitedUser.display_name,
        role: 'PARTICIPANT',
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ten użytkownik jest już uczestnikiem wyjazdu.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas dodawania uczestnika.' });
  }
};

// POBRANIE SZCZEGÓŁÓW WYJAZDU
// GET /api/trips/:tripId
exports.getTripDetails = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId, 't.*');

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    res.status(200).json({ trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania szczegółów wyjazdu.' });
  }
};

// POBRANIE LISTY UCZESTNIKÓW WYJAZDU
// GET /api/trips/:tripId/members
exports.getTripMembers = async (req, res) => {
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

    const members = await getTripMembersList(tripId);

    res.status(200).json({
      my_role: trip.my_role,
      members,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania listy uczestników.' });
  }
};

// ZMIANA ROLI UCZESTNIKA WYJAZDU (tylko dla organizatora)
// PATCH /api/trips/:tripId/members/:userId
exports.updateMemberRole = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const targetUserId = parsePositiveInt(req.params.userId);
  const requesterId = req.user.id;
  const { role } = req.body;

  if (!tripId || !targetUserId) {
    return res.status(400).json({
      error: 'Nieprawidłowy identyfikator wyjazdu lub użytkownika.',
    });
  }

  const allowedRoles = ['ORGANIZER', 'PARTICIPANT'];
  if (typeof role !== 'string' || !allowedRoles.includes(role)) {
    return res.status(400).json({
      error: 'Nieprawidłowa rola. Dozwolone wartości to: ORGANIZER lub PARTICIPANT.',
    });
  }

  try {
    const trip = await getTripWithRole(tripId, requesterId);
    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (trip.my_role !== 'ORGANIZER') {
      return res.status(403).json({
        error: 'Tylko organizator wyjazdu może zmieniać role uczestników.',
      });
    }

    const memberCheck = await pool.query(
      `SELECT role FROM trip_members
       WHERE trip_id = $1 AND user_id = $2`,
      [tripId, targetUserId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Ten użytkownik nie jest uczestnikiem tego wyjazdu.',
      });
    }

    if (memberCheck.rows[0].role === 'ORGANIZER' && role === 'PARTICIPANT') {
      const organizersCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM trip_members
         WHERE trip_id = $1 AND role = 'ORGANIZER'`,
        [tripId]
      );

      if (organizersCount.rows[0].count <= 1) {
        return res.status(409).json({
          error: 'Wyjazd musi mieć co najmniej jednego organizatora.',
        });
      }
    }

    await pool.query(
      `UPDATE trip_members
       SET role = $1
       WHERE trip_id = $2 AND user_id = $3`,
      [role, tripId, targetUserId]
    );

    const updatedMember = await pool.query(
      `SELECT u.id, u.email, u.display_name, tm.role
       FROM trip_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.trip_id = $1 AND tm.user_id = $2`,
      [tripId, targetUserId]
    );

    res.status(200).json({
      message: 'Rola uczestnika została zaktualizowana.',
      member: updatedMember.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas zmiany roli uczestnika.' });
  }
};