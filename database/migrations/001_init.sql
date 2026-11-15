-- 001_init.sql
-- Początkowy schemat bazy danych aplikacji do organizacji wspólnych wyjazdów (PostgreSQL)

-- Użytkownicy systemu (WF-01, WF-02, WF-16, WNF-01)
CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,                  -- hash bcrypt, nigdy jawne hasło
    is_admin      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()     -- potrzebne do statystyk nowych kont
);

-- Wyjazdy (WF-03, WF-12)
CREATE TABLE trips (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    start_date  DATE         NOT NULL,
    end_date    DATE         NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT trips_dates_check CHECK (end_date >= start_date)
);

-- Uczestnicy wyjazdu i ich rola w danym wyjeździe (WF-04, WF-05)
CREATE TABLE trip_members (
    trip_id   INTEGER     NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id   INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      VARCHAR(20) NOT NULL CHECK (role IN ('ORGANIZER', 'PARTICIPANT')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (trip_id, user_id)                        -- ta sama osoba nie może być dodana dwa razy
);

-- Punkty harmonogramu (WF-06)
CREATE TABLE plan_items (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id     INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    date        DATE         NOT NULL,
    time        TIME,
    title       VARCHAR(150) NOT NULL,
    description TEXT
);

-- Sprawy do załatwienia (WF-07)
CREATE TABLE tasks (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id          INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    assigned_user_id INTEGER      NOT NULL REFERENCES users(id),
    name             VARCHAR(150) NOT NULL,
    due_date         DATE,
    status           VARCHAR(10)  NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'DONE'))
);

-- Wydatki (WF-08)
CREATE TABLE expenses (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id         INTEGER       NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    paid_by_user_id INTEGER       NOT NULL REFERENCES users(id),
    name            VARCHAR(150)  NOT NULL,
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),   -- NUMERIC = dokładne grosze
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Część wydatku przypadająca na osobę (WF-09, WF-14, WF-15)
CREATE TABLE expense_shares (
    expense_id   INTEGER       NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id      INTEGER       NOT NULL REFERENCES users(id),
    share_amount NUMERIC(10,2) NOT NULL CHECK (share_amount >= 0),
    is_paid      BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (expense_id, user_id)
);

-- Dane przesłanych plików, sam plik leży na dysku serwera (WF-10, WF-11, WF-13, WNF-03)
CREATE TABLE files (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id             INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    uploaded_by_user_id INTEGER      NOT NULL REFERENCES users(id),
    plan_item_id        INTEGER      REFERENCES plan_items(id) ON DELETE SET NULL,  -- opcjonalne powiązanie
    file_name           VARCHAR(255) NOT NULL,
    file_type           VARCHAR(10)  NOT NULL CHECK (file_type IN ('PDF', 'JPG', 'PNG')),
    size_bytes          INTEGER      NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),  -- max 10 MB
    path                VARCHAR(500) NOT NULL,
    category            VARCHAR(10)  NOT NULL CHECK (category IN ('DOCUMENT', 'PHOTO')),
    uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Treść strony głównej edytowana przez admina (WF-17)
CREATE TABLE site_content (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    text       TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeksy na kluczach obcych (PostgreSQL nie tworzy ich automatycznie)
CREATE INDEX idx_trip_members_user ON trip_members(user_id);
CREATE INDEX idx_plan_items_trip   ON plan_items(trip_id);
CREATE INDEX idx_tasks_trip        ON tasks(trip_id);
CREATE INDEX idx_expenses_trip     ON expenses(trip_id);
CREATE INDEX idx_shares_user       ON expense_shares(user_id);
CREATE INDEX idx_files_trip        ON files(trip_id);
