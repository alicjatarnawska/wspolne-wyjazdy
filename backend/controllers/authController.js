const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { normalizeAndValidateEmail, validateTextField } = require('../utils/validators');
const { generateUserToken } = require('../utils/tokenHelper');

// REJESTRACJA
// POST /api/auth/register
exports.register = async (req, res) => {
  const { email, password, display_name } = req.body;

  if (
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' ||
    typeof display_name !== 'string' || !display_name.trim()
  ) {
    return res.status(400).json({ error: 'Wszystkie pola są wymagane.' });
  }

  const emailCheck = normalizeAndValidateEmail(email);
  if (emailCheck.error) {
    return res.status(400).json({ error: emailCheck.error });
  }

  const nameCheck = validateTextField(display_name, {
    requiredMsg: 'Nazwa użytkownika jest wymagana.',
    maxLength: 50,
    maxLengthMsg: 'Nazwa użytkownika może mieć maksymalnie 50 znaków.',
  });
  if (nameCheck.error) {
    return res.status(400).json({ error: nameCheck.error });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Hasło musi mieć co najmniej 6 znaków.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, is_admin, created_at`,
      [emailCheck.value, hashedPassword, nameCheck.value]
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
  const { email, password } = req.body;

  if (
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password
  ) {
    return res.status(400).json({ error: 'Podaj e-mail i hasło.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, display_name, password_hash, is_admin FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło.' });
    }

    const token = generateUserToken(user);

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