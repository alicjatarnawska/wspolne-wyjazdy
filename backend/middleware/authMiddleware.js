const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Brak tokena autoryzacyjnego. Zaloguj się.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; //  id, email, is_admin 
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token nieprawidłowy lub wygasł.' });
  }
};