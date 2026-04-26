const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'ezspending.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  user_id INTEGER,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '📦',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS spending_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  category_id INTEGER,
  receipt_path TEXT,
  recorded_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
)`);

// Seed default categories once
const { count } = db.prepare('SELECT COUNT(*) as count FROM categories WHERE user_id IS NULL').get();
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO categories (name, user_id, color, icon) VALUES (?, NULL, ?, ?)'
  );
  const seed = [
    ['Food & Dining',     '#F59E0B', '🍕'],
    ['Transport',         '#3B82F6', '🚗'],
    ['Entertainment',     '#8B5CF6', '🎬'],
    ['Shopping',          '#EC4899', '🛍️'],
    ['Health',            '#10B981', '💊'],
    ['Education',         '#14B8A6', '📚'],
    ['Bills & Utilities', '#F97316', '🔌'],
    ['Other',             '#6B7280', '📦'],
  ];
  for (const [name, color, icon] of seed) insert.run(name, color, icon);
}

module.exports = db;
