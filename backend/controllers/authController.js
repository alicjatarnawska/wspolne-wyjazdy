const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// REJESTRACJA
// POST /api/auth/register
exports.register = async (req, res) => {
  const { email, password, display_name } = req.body;

  if (
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' ||
    typeof display_name !== 'string' || !display_name.trim()) {
    return res.status(400).json({ error: 'Wszystkie pola są wymagane.' });
  }

  // walidacja formatu oraz maksymalnej długości adresu e-mail
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

  // walidacja długości hasła
  if (password.length < 6) {
    return res.status(400).json({ error: 'Hasło musi mieć co najmniej 6 znaków.' });
  }

  try {
    //hashowanie hasła
    const hashedPassword = await bcrypt.hash(password, 10);
    //zapis użytkownika w bazie danych
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, is_admin, created_at`,
      [trimmedEmail, hashedPassword, trimmedDisplayName]
    );

    res.status(201).json({
      message: 'Konto zostało utworzone.',
      user: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Użytkownik o podanym adresie e-mail już istnieje.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas rejestracji.' });
  }
};

// LOGOWANIE
// POST /api/auth/login
exports.login = async (req, res) => {
    //pobranie danych z żądania
  const { email, password } = req.body;

  if (typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password
  ) {
    return res.status(400).json({ error: 'Podaj e-mail i hasło.' });
  }

  try {
    //wyszukanie użytkownika w bazie danych po adresie e-mail
    const result = await pool.query(
      'SELECT id, email, display_name, password_hash, is_admin FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło.' });
    }

    // wygenerowanie tokena JWT podpisanego kluczem JWT_SECRET z pliku .env
    // token zawiera id, email, display_name i is_admin użytkownika, a jego ważność wynosi 2 godziny
    const token = jwt.sign(
      { id: user.id, 
        email: user.email, 
        display_name: user.display_name,
        is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(200).json({
      message: 'Zalogowano pomyślnie.',
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        is_admin: user.is_admin,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas logowania.' });
  }
};