-- 002_add_display_name.sql
-- Nazwa wyswietlana uzytkownika (do zadan i rozliczen)

ALTER TABLE users ADD COLUMN display_name VARCHAR(50);

-- istniejace konta dostaja nazwe z e-maila, np. ola@example.com -> Ola
UPDATE users SET display_name = initcap(split_part(email, '@', 1))
WHERE display_name IS NULL;

ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE users
    ADD CONSTRAINT users_display_name_not_blank CHECK (length(trim(display_name)) > 0);