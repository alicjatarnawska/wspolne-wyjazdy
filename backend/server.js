require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ status: 'OK', usersCount: Number(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});