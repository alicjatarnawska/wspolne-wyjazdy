//wczytanie zmiennych środowiskowych z pliku .env
require('dotenv').config();
//import bibliotek
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

//import modułów z definicjami tras
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');
const userRoutes = require('./routes/userRoutes');

//główna instancja aplikacji
const app = express();

app.use(cors()); //zezwala przeglądarce na wysyłanie żądań z innego portu/domeny
app.use(express.json()); //automatycznie parsuje treść żądań w formacie JSON -> zapis w req.body

//endpoint GET /api/health służy do sprawdzenia czy serwer działa i poprawnie łączy się z bazą danych
app.get('/api/health', async (req, res) => {
  try {
    //testowe zapytanie do bazy o liczbę użytkowników
    const result = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ status: 'OK', usersCount: Number(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

//podpięcie zaimportowanych modułów z trasami pod odpowiednie prefixy ścieżek URL
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/users', userRoutes);

//pobranie numeru portu z pliku .env lub ustawienie domyślnego
const PORT = process.env.PORT || 5000;

//uruchomienie serwera i rozpoczęcie nasłuchiwania żądań HTTP
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
