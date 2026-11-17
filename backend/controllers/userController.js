const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// POBRANIE PEŁNYCH DANYCH PROFILU, STATYSTYK ORAZ NADCHODZĄCYCH WYJAZDÓW
// GET /api/users/me
exports.getMe = async (req, res) => {
  const userId = req.user.id;

  try {
    // podstawowe dane użytkownika z tabeli 'users'
    const userResult = await pool.query(
      'SELECT id, email, display_name, is_admin, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
    }

    const user = userResult.rows[0];

    // pobranie statystyk wyjazdów oraz wyjazdów startujących w ciągu <= 7 dni
    const [statsResult, upcomingTripsResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_trips,
           COUNT(*) FILTER (WHERE role = 'ORGANIZER')::int AS organized_trips,
           COUNT(*) FILTER (WHERE role = 'PARTICIPANT')::int AS participant_trips
         FROM trip_members
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT
           t.id,
           t.name,
           t.destination,
           t.start_date,
           t.end_date,
           tm.role,
           (t.start_date::date - CURRENT_DATE)::int AS days_left
         FROM trips t
         JOIN trip_members tm ON t.id = tm.trip_id
         WHERE tm.user_id = $1
           AND t.start_date::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')::date
         ORDER BY t.start_date ASC`,
        [userId]
      ),
    ]);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        is_admin: user.is_admin,
        role: user.is_admin ? 'Administrator' : 'Użytkownik',
        created_at: user.created_at,
      },
      stats: statsResult.rows[0],
      upcoming_trips: upcomingTripsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania danych profilu.' });
  }
};


// AKTUALIZACJA DANYCH PROFILU (nick i e-mail)
// PATCH /api/users/profile
exports.updateProfile = async (req, res) => {
  const { display_name, email } = req.body;
  const userId = req.user.id;

  // walidacja obecności i typu danych
  if (
    typeof display_name !== 'string' || !display_name.trim() ||
    typeof email !== 'string' || !email.trim()
  ) {
    return res.status(400).json({
      error: 'Nazwa użytkownika oraz adres e-mail są wymagane.',
    });
  }

  // walidacja formatu i długości e-maila
  const trimmedEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 255) {
    return res.status(400).json({
      error: 'Podaj poprawny adres e-mail.',
    });
  }

  // walidacja długości nicku
  const trimmedDisplayName = display_name.trim();
  if (trimmedDisplayName.length > 50) {
    return res.status(400).json({
      error: 'Nazwa użytkownika może mieć maksymalnie 50 znaków.',
    });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET display_name = $1, email = $2
       WHERE id = $3
       RETURNING id, email, display_name, is_admin, created_at`,
      [trimmedDisplayName, trimmedEmail, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
    }

    const updatedUser = result.rows[0];

    // wygenerowanie nowego tokena JWT zawierającego zaktualizowany e-mail i display_name
    const token = jwt.sign(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        display_name: updatedUser.display_name,
        is_admin: updatedUser.is_admin,
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(200).json({
      message: 'Dane profilu zostały zaktualizowane.',
      token,
      user: { ...updatedUser, role: updatedUser.is_admin ? 'Administrator' : 'Użytkownik' },
    });
  } catch (err) {
    // kod 23505: inny użytkownik ma już taki adres e-mail
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Istnieje już konto z tym adresem e-mail.',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas aktualizacji profilu.' });
  }
};

// ZMIANA HASŁA
// PATCH /api/users/profile/password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // walidacja obecności i typu obu haseł
  if (
    typeof currentPassword !== 'string' || !currentPassword ||
    typeof newPassword !== 'string' || !newPassword
  ) {
    return res.status(400).json({
      error: 'Podaj obecne oraz nowe hasło.',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      error: 'Nowe hasło musi mieć co najmniej 6 znaków.',
    });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
    }

    // weryfikacja obecnego hasła przed ustawieniem nowego
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Obecne hasło jest nieprawidłowe.' });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newHashedPassword, userId]
    );

    res.status(200).json({ message: 'Hasło zostało pomyślnie zmienione.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas zmiany hasła.' });
  }
};

// USUNIĘCIE KONTA UŻYTKOWNIKA
// DELETE /api/users/profile
exports.deleteAccount = async (req, res) => {
  const { password } = req.body;
  const userId = req.user.id;

  // wymagane potwierdzenie hasłem, aby zapobiec przypadkowemu usunięciu konta
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({
      error: 'Podaj aktualne hasło, aby potwierdzić usunięcie konta.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // pobranie hasła i weryfikacja użytkownika
    const userResult = await client.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Podane hasło jest nieprawidłowe.' });
    }

    // sprawdzenie, czy użytkownik nie jest jedynym organizatorem wyjazdu z innymi uczestnikami
    const soleOrganizerTrips = await client.query(
      `SELECT t.id, t.name
       FROM trips t
       JOIN trip_members tm ON t.id = tm.trip_id
       WHERE tm.user_id = $1
         AND tm.role = 'ORGANIZER'
         AND EXISTS (
           SELECT 1 FROM trip_members tm_other
           WHERE tm_other.trip_id = t.id AND tm_other.user_id != $1
         )
         AND NOT EXISTS (
           SELECT 1 FROM trip_members tm_org
           WHERE tm_org.trip_id = t.id AND tm_org.user_id != $1 AND tm_org.role = 'ORGANIZER'
         )`,
      [userId]
    );

    if (soleOrganizerTrips.rows.length > 0) {
      await client.query('ROLLBACK');
      const tripNames = soleOrganizerTrips.rows.map((t) => t.name).join(', ');
      return res.status(409).json({
        error: `Nie możesz usunąć konta, ponieważ jesteś jedynym organizatorem wyjazdów: ${tripNames}. Usuń je lub przekaż rolę organizatora innemu uczestnikowi.`,
      });
    }

    //usunięcie pustych wyjazdów, w których użytkownik był jedynym uczestnikiem
    await client.query(
      `DELETE FROM trips
       WHERE id IN (
         SELECT tm.trip_id
         FROM trip_members tm
         WHERE tm.user_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM trip_members tm2
             WHERE tm2.trip_id = tm.trip_id AND tm2.user_id != $1
           )
       )`,
      [userId]
    );

    // usunięcie członkostw i samego konta użytkownika
    await client.query('DELETE FROM trip_members WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    res.status(200).json({ message: 'Konto zostało trwale usunięte.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania konta.' });
  } finally {
    client.release();
  }
};