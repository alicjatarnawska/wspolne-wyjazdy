const pool = require('../config/db');

// tworzenie nowego wyjazdu
// POST /api/trips
exports.createTrip = async (req, res) => {
    // pobranie danych z żądania
  const { name, destination, start_date, end_date, description } = req.body;
  const userId = req.user.id;

  if (!name || !destination || !start_date || !end_date) {
    return res.status(400).json({
      error: 'Nazwa, miejsce docelowe, data rozpoczęcia i zakończenia są wymagane.',
    });
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
      [name.trim(), destination.trim(), start_date, end_date, description || null]
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

  if (!email) {
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
      'SELECT id, email FROM users WHERE email = $1',
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