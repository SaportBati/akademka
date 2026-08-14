-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Reports table (existing data structure)
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    code TEXT NOT NULL,
    date TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    user_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Situations table (existing data structure)
CREATE TABLE IF NOT EXISTS situations (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    subsection TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (report_id) REFERENCES reports(id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_situations_report ON situations(report_id);
