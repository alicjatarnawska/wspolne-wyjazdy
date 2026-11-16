# TravelTogether – Aplikacja do organizacji wspólnych wyjazdów

System webowy ułatwiający planowanie wyjazdów grupowych, zarządzanie uczestnikami, harmonogramem, zadaniami oraz rozliczaniem wspólnych wydatków.

## Technologie
* **Backend:** Node.js, Express.js, JWT (`jsonwebtoken`), `bcrypt`
* **Frontend:** Vue.js, Vite, JavaScript, HTML, CSS
* **Baza danych:** PostgreSQL

---

## Wymagania wstępne
Przed uruchomieniem projektu upewnij się, że masz zainstalowane:
* [Node.js](https://nodejs.org/) (zalecana wersja LTS)
* [PostgreSQL](https://www.postgresql.org/) (wraz z pgAdmin 4)

---

## Instrukcja uruchomienia

### 1. Przygotowanie bazy danych
1. Utwórz w PostgreSQL nową bazę danych o nazwie "wspolne_wyjazdy".
2. Otwórz narzędzie **Query Tool** w pgAdmin 4 dla tej bazy i wykonaj skrypty SQL 'database/migrations/001_init.sql' oraz 'database/seeds/001_test_data.sql'

### 2. Instalacja zależności
W katalogu głównym projektu wykonaj następujące polecenia:
```bash
cd backend
npm install
```

### 3. Konfiguracja zmiennych środowiskowych
1. Skopiuj plik `backend/.env.example` i zapisz go jako `backend/.env`.
2. Uzupełnij w pliku `.env` swoje lokalne dane dostępowe do bazy PostgreSQL oraz dowolny ciąg znaków dla `JWT_SECRET`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=twoje_haslo_do_bazy 
DB_NAME=wspolne_wyjazdy
JWT_SECRET=dowolny_tajny_ciag_znakow
```

### 4. Uruchomienie serwera
W katalogu '/backend' uruchom serwer poleceniem:
```bash
npm run dev
```
Poprawnie uruchomiony serwer wyświetli komunikat: `Serwer działa na porcie 5000`.

### 5. Instalacja zależności frontendu
W katalogu głównym projektu wykonaj następujące polecenia:
```bash
cd frontend
npm install
```

### 6. Uruchomienie frontendu
W katalogu '/frontend' uruchom aplikację poleceniem:
```bash
npm run dev
```

Po uruchomieniu zostanie wyświetlony adres aplikacji, zazwyczaj: 
```bash
http://localhost:5173/
```
Otwórz ten adres w przeglądarce.

**Uwaga**: backend i frontend muszą działać jednocześnie w dwóch osobnych terminalach.


---
