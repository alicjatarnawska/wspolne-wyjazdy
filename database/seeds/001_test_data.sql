-- 001_test_data.sql
-- Dane testowe do demo i testów. Hasło każdego konta: haslo123

INSERT INTO users (email, password_hash, is_admin) VALUES
    ('ola@example.com',    '$2b$10$UNmZB3tIL1uHFh750/FmKuKRrvFvHaMjrfa8FgfLwfYm8bTYwOgwK', FALSE),
    ('kasia@example.com',  '$2b$10$UNmZB3tIL1uHFh750/FmKuKRrvFvHaMjrfa8FgfLwfYm8bTYwOgwK', FALSE),
    ('alicja@example.com', '$2b$10$UNmZB3tIL1uHFh750/FmKuKRrvFvHaMjrfa8FgfLwfYm8bTYwOgwK', FALSE),
    ('admin@example.com',  '$2b$10$UNmZB3tIL1uHFh750/FmKuKRrvFvHaMjrfa8FgfLwfYm8bTYwOgwK', TRUE);

INSERT INTO trips (name, destination, start_date, end_date, description) VALUES
    ('Mazury', 'Giżycko', '2027-05-14', '2027-05-16', 'Długi weekend nad jeziorem');

-- Ola organizuje, Kasia i Alicja uczestniczą
INSERT INTO trip_members (trip_id, user_id, role) VALUES
    (1, 1, 'ORGANIZER'),
    (1, 2, 'PARTICIPANT'),
    (1, 3, 'PARTICIPANT');

INSERT INTO plan_items (trip_id, date, time, title) VALUES
    (1, '2027-05-14', '10:00', 'Wyjazd z Katowic'),
    (1, '2027-05-14', '15:00', 'Zameldowanie w ośrodku'),
    (1, '2027-05-15', '11:00', 'Wypożyczenie kajaków');

INSERT INTO tasks (trip_id, assigned_user_id, name, due_date, status) VALUES
    (1, 1, 'Zarezerwować nocleg', NULL, 'DONE'),
    (1, 2, 'Kupić bilety', '2027-05-01', 'TODO'),
    (1, 3, 'Wziąć namiot', NULL, 'TODO');

-- Przypadek z kryteriów akceptacji: 100 zł na 3 osoby
INSERT INTO expenses (trip_id, paid_by_user_id, name, amount) VALUES
    (1, 1, 'Nocleg', 100.00);

INSERT INTO expense_shares (expense_id, user_id, share_amount, is_paid) VALUES
    (1, 1, 33.34, TRUE),     -- płacąca dostaje „resztę” z zaokrąglenia
    (1, 2, 33.33, FALSE),
    (1, 3, 33.33, FALSE);

INSERT INTO site_content (text) VALUES
    ('Planuj wspólne wyjazdy w jednym miejscu: plan, zadania, wydatki i pliki.');
