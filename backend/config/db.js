//import klasy Pool z biblioteki pg do zarządzania pulą połączeń z bazą danych
//pozwala to wielokrotnie wykorzystywać otwarte połączenia zamiast tworzyć nowe przy każdym zapytaniu
const { Pool } = require('pg');

//konfiguracja połączenia:
//jeśli w .env ustawiono pełny adres DATABASE_URL (np. baza w chmurze), łączymy się przez 'connectionString' z włączonym szyfrowaniem SSL
//w przeciwnym razie (lokalna baza na komputerze) korzystamy z pojedynczych zmiennych DB_*
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 5432,
    });

//eksport puli połączeń, aby kontrolery mogły wykonywać zapytania SQL przez pool.query()
module.exports = pool;
