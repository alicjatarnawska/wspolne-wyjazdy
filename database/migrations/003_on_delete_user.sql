-- 003_on_delete_user.sql
-- Usuniecie uzytkownika nie kasuje zadan, wydatkow i plikow, tylko zeruje autora

ALTER TABLE tasks
    ALTER COLUMN assigned_user_id DROP NOT NULL,
    DROP CONSTRAINT tasks_assigned_user_id_fkey,
    ADD CONSTRAINT tasks_assigned_user_id_fkey
        FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE expenses
    ALTER COLUMN paid_by_user_id DROP NOT NULL,
    DROP CONSTRAINT expenses_paid_by_user_id_fkey,
    ADD CONSTRAINT expenses_paid_by_user_id_fkey
        FOREIGN KEY (paid_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE files
    ALTER COLUMN uploaded_by_user_id DROP NOT NULL,
    DROP CONSTRAINT files_uploaded_by_user_id_fkey,
    ADD CONSTRAINT files_uploaded_by_user_id_fkey
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- czesc dlugu usuwanej osoby znika razem z kontem
ALTER TABLE expense_shares
    DROP CONSTRAINT expense_shares_user_id_fkey,
    ADD CONSTRAINT expense_shares_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;