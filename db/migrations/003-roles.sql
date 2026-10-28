-- A person's role comes from the allowlist on the server, read at every
-- sign-in. manager_since is when they first signed in as a manager: reps
-- report to the manager who did so first.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'rep' CHECK (role IN ('rep', 'manager'));
ALTER TABLE users ADD COLUMN manager_since TEXT;
