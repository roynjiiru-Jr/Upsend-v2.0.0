-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TEXT NOT NULL,
  cover_image TEXT,
  shareable_link TEXT UNIQUE NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_name TEXT,
  message_text TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Contributions table
CREATE TABLE IF NOT EXISTS contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  contributor_name TEXT,
  amount REAL NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Magic links table
CREATE TABLE IF NOT EXISTS magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_shareable_link ON events(shareable_link);
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_contributions_event_id ON contributions(event_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
