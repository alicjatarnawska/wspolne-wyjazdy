const jwt = require('jsonwebtoken');

// generowanie tokena JWT dla użytkownika
const generateUserToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      is_admin: user.is_admin,
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

module.exports = { generateUserToken };