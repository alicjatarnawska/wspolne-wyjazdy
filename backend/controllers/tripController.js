const pool = require('../config/db');
const fs = require('fs/promises');

// wykrywanie potencjalnie niebezpiecznych znaczników HTML/JS (ochrona przed XSS)
const containsScriptOrHtml = (text) =>
  /<[^>]*>/.test(text) ||
  /<\s*\/?\s*script/i.test(text) ||
  /javascript\s*:/i.test(text) ||
  /\bon\w+\s*=/i.test(text);

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

  const trimmedName = name.trim();
  const trimmedDestination = destination.trim();

  if (trimmedName.length > 100) {
    return { error: 'Nazwa wyjazdu może mieć maksymalnie 100 znaków.' };
  }

  if (trimmedDestination.length > 100) {
    return { error: 'Miejsce docelowe może mieć maksymalnie 100 znaków.' };
  }

  if (containsScriptOrHtml(trimmedName) || containsScriptOrHtml(trimmedDestination)) {
    return { error: 'Nazwa oraz miejsce docelowe nie mogą zawierać kodu HTML ani skryptów.' };
  }

  if (end_date < start_date) {
    return { error: 'Data zakończenia wyjazdu nie może być wcześniejsza niż data rozpoczęcia.' };
  }

  // walidacja opcjonalnego opisu wyjazdu (maksymalnie 500 znaków, brak HTML/JS)
  let normalizedDescription = null;
  if (description !== undefined && description !== null && description !== '') {
    if (typeof description !== 'string') {
      return { error: 'Opis wyjazdu musi być tekstem.' };
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 500) {
      return { error: 'Opis wyjazdu może mieć maksymalnie 500 znaków.' };
    }

    if (containsScriptOrHtml(trimmedDescription)) {
      return { error: 'Opis wyjazdu nie może zawierać kodu HTML ani skryptów.' };
    }

    normalizedDescription = trimmedDescription || null;
  }

  return {
    data: {
      name: trimmedName,
      destination: trimmedDestination,
      start_date,
      end_date,
      description: normalizedDescription,
    },
  };
};

// tworzenie nowego wyjazdu
// POST /api/trips
exports.createTrip = async (req, res) => {

  const userId = req.user.id;

  const { error, data } = validateTripData(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  // połączenie z bazą danych i rozpoczęcie transakcji
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // zapis nowego wyjazdu do tabeli 'trips'
    const tripResult = await client.query(
      `INSERT INTO trips (name, destination, start_date, end_date, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.destination, data.start_date, data.end_date, data.description]
    );
    const newTrip = tripResult.rows[0];

    // dodanie twórcy wyjazdu do tabeli 'trip_members' z rolą 'ORGANIZER'
    await client.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'ORGANIZER')`,
      [newTrip.id, userId]
    );
    // zatwierdzenie transakcji
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
    console.error(err);
    res.status(500).json({ error: 'Nie udało się utworzyć wyjazdu.' });
  } finally {
    //zwolnienie klienta z puli połączeń niezależnie od wyniku operacji
    client.release();
  }
}; 

// edycja danych wyjazdu (tylko dla organizatora)
// PATCH /api/trips/:tripId
exports.updateTrip = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const userId = req.user.id;

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    // pobranie obecnych danych wyjazdu oraz roli użytkownika
    const tripResult = await pool.query(
      `SELECT t.*, tm.role AS my_role
       FROM trips t
       LEFT JOIN trip_members tm
         ON t.id = tm.trip_id AND tm.user_id = $2
       WHERE t.id = $1`,
      [tripId, userId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }

    const currentTrip = tripResult.rows[0];

    if (!currentTrip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    if (currentTrip.my_role !== 'ORGANIZER') {
      return res.status(403).json({ error: 'Tylko organizator wyjazdu może edytować jego dane.' });
    }

    // scalenie obecnych pól z nowymi (obsługuje pełny formularz edycji oraz pojedyncze pola)
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

    // ochrona spójności harmonogramu: jeśli skrócono termin wyjazdu, sprawdzamy czy w bazie
    // nie zostaną punkty harmonogramu poza nowym zakresem dat
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
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas aktualizacji wyjazdu.' });
  }
};

// usunięcie uczestnika przez organizatora lub samodzielne opuszczenie wyjazdu
// DELETE /api/trips/:tripId/members/:userId (oraz /members/me dla opuszczenia wyjazdu przez siebie)
exports.removeMember = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const requesterId = req.user.id;
  const targetUserId =
    req.params.userId === 'me' ? requesterId : Number(req.params.userId);

  if (!Number.isInteger(tripId) || tripId <= 0 || !Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({
      error: 'Nieprawidłowy identyfikator wyjazdu lub użytkownika.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    //sprawdzenie, czy wyjazd w ogóle istnieje
    const tripCheck = await client.query('SELECT id FROM trips WHERE id = $1', [tripId]);
    if (tripCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }

    // pobranie wszystkich członków wyjazdu w jednym zapytaniu, aby sprawdzić role obu użytkowników oraz liczbę organizatorów
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

    //jeśli ktoś próbuje usunąć inną osobę, musi być organizatorem
    if (!isSelfLeave && requesterMember.role !== 'ORGANIZER') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Tylko organizator wyjazdu może usuwać innych uczestników.',
      });
    }

    //wyjazd nie może zostać zupełnie pusty bez żadnego uczestnika
    if (members.length === 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Jesteś jedynym uczestnikiem tego wyjazdu. Aby go zakończyć, usuń cały wyjazd.',
      });
    }

    // zabezpieczenie przed pozostawieniem wyjazdu bez żadnego organizatora
    const organizers = members.filter((m) => m.role === 'ORGANIZER');
    if (targetMember.role === 'ORGANIZER' && organizers.length <= 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Nie możesz opuścić wyjazdu jako jedyny organizator. Najpierw przekaż rolę organizatora innemu uczestnikowi.',
      });
    }

   // odpięcie zadań odchodzącego uczestnika (stają się nieprzypisane)
    await client.query(
      `UPDATE tasks
       SET assigned_user_id = NULL
       WHERE trip_id = $1 AND assigned_user_id = $2`,
      [tripId, targetUserId]
    );

    // usunięcie rekordu z tabeli 'trip_members'
    await client.query(
      'DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2',
      [tripId, targetUserId]
    );

    await client.query('COMMIT');

    res.status(200).json({
      message: isSelfLeave
        ? 'Opuszczono wyjazd.'
        : 'Uczestnik został usunięty z wyjazdu.',
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

// usunięcie wyjazdu wraz ze wszystkimi powiązanymi danymi (tylko dla organizatora)
// DELETE /api/trips/:tripId
exports.deleteTrip = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const userId = req.user.id;

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    //sprawdzenie, czy wyjazd istnieje oraz czy zalogowany użytkownik jest jego organizatorem
    const tripResult = await pool.query(
      `SELECT t.id, tm.role AS my_role
       FROM trips t
       LEFT JOIN trip_members tm
         ON t.id = tm.trip_id AND tm.user_id = $2
       WHERE t.id = $1`,
      [tripId, userId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }

    const trip = tripResult.rows[0];

    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    if (trip.my_role !== 'ORGANIZER') {
      return res.status(403).json({ error: 'Tylko organizator wyjazdu może go usunąć.' });
    }

    // pobranie ścieżek plików przypisanych do wyjazdu przed usunięciem rekordów z bazy
    const filesResult = await pool.query(
      'SELECT path FROM files WHERE trip_id = $1',
      [tripId]
    );

    // usunięcie wyjazdu z bazy
    await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);

    // uunięcie fizycznych plików z dysku serwera
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

// pobranie listy wyjazdów użytkownika
// GET /api/trips
exports.getUserTrips = async (req, res) => {
    // pobranie id użytkownika z tokena JWT
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

// dodawanie nowego uczestnika do wyjazdu (tylko dla organizatora)
// POST /api/trips/:tripId/members
exports.inviteMember = async (req, res) => {
    // pobranie ID wyjazdu z parametrów ścieżki URL, e-maila z body oraz ID osoby zapraszającej z tokena JWT
  const tripId = Number(req.params.tripId);
  const { email } = req.body;
  const requesterId = req.user.id;

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Podaj adres e-mail zapraszanego użytkownika.' });
  }

  try {
    // sprawdzenie, czy osoba wysyłająca żądanie jest organizatorem wyjazdu
    const organizerCheck = await pool.query(
      `SELECT role FROM trip_members
       WHERE trip_id = $1 AND user_id = $2 AND role = 'ORGANIZER'`,
      [tripId, requesterId]
    );
    // czy użytkownik jest organizatorem wyjazdu, jeśli nie to zwrócenie błędu 403
    if (organizerCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Tylko organizator wyjazdu może dodawać nowych uczestników.',
      });
    }

    // wyszukanie zapraszanego użytkownika po adresie e-mail
    const userResult = await pool.query(
      'SELECT id, email, display_name FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Nie znaleziono konta powiązanego z podanym adresem e-mail.',
      });
    }

    const invitedUser = userResult.rows[0];

    // zapisanie nowego uczestnika z rolą PARTICIPANT
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
    // osoba już należy do tego wyjazdu (naruszenie klucza głownego w tabeli 'trip_members')
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ten użytkownik jest już uczestnikiem wyjazdu.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas dodawania uczestnika.' });
  }
};

// pomocnicza funkcja sprawdzająca przynależność i rolę użytkownika w wyjeździe
const getUserTripRole = async (tripId, userId) => {
  const result = await pool.query(
    'SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2',
    [tripId, userId]
  );
  return result.rows[0]?.role || null;
};

// pobranie samych szczegółów wyjazdu
// GET /api/trips/:tripId
exports.getTripDetails = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const userId = req.user.id;

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    const tripResult = await pool.query(
      `SELECT t.*, tm.role AS my_role
       FROM trips t
       LEFT JOIN trip_members tm
         ON t.id = tm.trip_id AND tm.user_id = $2
       WHERE t.id = $1`,
      [tripId, userId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }

    const trip = tripResult.rows[0];

    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    res.status(200).json({ trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania szczegółów wyjazdu.' });
  }
};

// pobranie listy uczestników wyjazdu (zakładka "Uczestnicy")
// GET /api/trips/:tripId/members
exports.getTripMembers = async (req, res) => {
  const tripId = Number(req.params.tripId);
  const userId = req.user.id;

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    // sprawdzenie, czy zalogowany użytkownik należy do tego wyjazdu
    const myRole = await getUserTripRole(tripId, userId);

    if (!myRole) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const membersResult = await pool.query(
      `SELECT
         u.id,
         u.email,
         u.display_name,
         tm.role,
         tm.joined_at
       FROM trip_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.trip_id = $1
       ORDER BY
         CASE WHEN tm.role = 'ORGANIZER' THEN 0 ELSE 1 END,
         tm.joined_at ASC`,
      [tripId]
    );

    res.status(200).json({
      my_role: myRole,
      members: membersResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania listy uczestników.' });
  }
};


// zmiana roli uczestnika wyjazdu (tylko dla organizatora)
// PATCH /api/trips/:tripId/members/:userId
exports.updateMemberRole = async (req, res) => {
  // pobranie ID wyjazdu i ID uczestnika z URL, nowej roli z body oraz ID osoby wykonującej z JWT
  const tripId = Number(req.params.tripId);
  const targetUserId = Number(req.params.userId);
  const requesterId = req.user.id;
  const { role } = req.body;

  if (!Number.isInteger(tripId) || !Number.isInteger(targetUserId)) {
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
    // sprawdzenie, czy osoba wysyłająca żądanie jest organizatorem tego wyjazdu
    const organizerCheck = await pool.query(
      `SELECT role FROM trip_members
       WHERE trip_id = $1 AND user_id = $2 AND role = 'ORGANIZER'`,
      [tripId, requesterId]
    );

    if (organizerCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Tylko organizator wyjazdu może zmieniać role uczestników.',
      });
    }

    // sprawdzenie, czy docelowy użytkownik należy do tego wyjazdu
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

    // zabezpieczenie przed odebraniem roli ostatniemu organizatorowi wyjazdu
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

    // aktualizacja roli w tabeli 'trip_members'
    await pool.query(
      `UPDATE trip_members
       SET role = $1
       WHERE trip_id = $2 AND user_id = $3`,
      [role, tripId, targetUserId]
    );

    // pobranie zaktualizowanego obiektu uczestnika
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