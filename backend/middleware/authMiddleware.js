//import biblioteki do weryfikacji tokenów JWT
const jwt = require('jsonwebtoken');

//middleware autoryzacyjny, chroni trasy wymagające zalogowania
module.exports = (req, res, next) => {
  //pobranie nagłówka Autorization z żądania (format: "Bearer <token>")
  const authHeader = req.headers['authorization'];
  //rozdzielenie tekstu po spacji i wyciągnięcie samego tokena (drugi element tablicy)
  const token = authHeader && authHeader.split(' ')[1];
  //jeśli nie przesłano nagłówka lub tokena - blokada dostępu
  if (!token) {
    return res.status(401).json({ error: 'Brak tokena autoryzacyjnego. Zaloguj się.' });
  }

  try {
    //weryfikacja tokenu
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; //zapis danych użytkkownika (id, email, is_admin) 
    next(); //przekazanie żądania dalej
  } catch (err) {
    return res.status(403).json({ error: 'Token nieprawidłowy lub wygasł.' });
  }
};
