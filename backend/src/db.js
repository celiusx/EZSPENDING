const path = require('path');
const fs = require('fs');

let query;

// ── SQLite transform: convert PG-flavoured SQL to SQLite ─────────────────────
function toSQLite(sql) {
  return sql
    // Casts: X::date::text → date(X), X::date → date(X), ::type → removed
    .replace(/([\w.]+)::date::text\b/g, 'date($1)')
    .replace(/([\w.]+)::date\b/g,       'date($1)')
    .replace(/::(?:int|bigint|float|text|numeric)/g, '')
    // Date functions
    .replace(/TO_CHAR\(([^,]+),\s*'YYYY-MM'\)/gi, "strftime('%Y-%m', $1)")
    .replace(/TO_CHAR\(([^,]+),\s*'HH24:00'\)/gi,  "strftime('%H:00', $1)")
    .replace(/TO_CHAR\(([^,]+),\s*'HH24'\)/gi,     "strftime('%H', $1)")
    .replace(/TO_CHAR\(([^,]+),\s*'YYYY'\)/gi,     "strftime('%Y', $1)")
    .replace(/EXTRACT\(YEAR FROM ([^)]+)\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)")
    // DATE_TRUNC('week', CURRENT_DATE) → computed Monday
    .replace(/DATE_TRUNC\('week',\s*CURRENT_DATE\)/gi, () => {
      const d = new Date();
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
      return `'${d.toISOString().split('T')[0]}'`;
    })
    // CURRENT_DATE - INTERVAL 'N days' → computed date string
    .replace(/CURRENT_DATE\s*-\s*INTERVAL\s*'(\d+)\s*days'/gi, (_m, n) => {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(n));
      return `'${d.toISOString().split('T')[0]}'`;
    })
    .replace(/\bCURRENT_DATE\b/g, "date('now')")
    .replace(/\bNOW\(\)/g,        'CURRENT_TIMESTAMP')
    // Schema differences
    .replace(/\bSERIAL\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/\bNUMERIC\(\d+,\s*\d+\)/g, 'REAL')
    // Positional params $1 → ?
    .replace(/\$\d+/g, '?');
}

if (process.env.DATABASE_URL) {
  // ── PostgreSQL (used on Render) ─────────────────────────────────────────
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  query = (sql, params) => pool.query(sql, params);

} else {
  // ── SQLite (local dev, zero setup) ──────────────────────────────────────
  const { DatabaseSync } = require('node:sqlite');
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'ezspending.db'));

  query = async (sql, params = []) => {
    const s = toSQLite(sql);

    // Handle RETURNING clause (not supported natively in SQLite)
    const retMatch = s.match(/\s+RETURNING\s+(?:\*|\w+)\s*$/i);
    if (retMatch) {
      const cleanSql = s.replace(/\s+RETURNING\s+(?:\*|\w+)\s*$/i, '');
      const tableMatch = cleanSql.match(/INSERT\s+INTO\s+(\w+)/i);
      const result = db.prepare(cleanSql).run(...params);
      if (tableMatch && result.lastInsertRowid) {
        const row = db.prepare(`SELECT * FROM ${tableMatch[1]} WHERE id = ?`).get(result.lastInsertRowid);
        return { rows: row ? [row] : [] };
      }
      return { rows: [{ id: result.lastInsertRowid }] };
    }

    if (/^\s*SELECT\b/i.test(s)) {
      return { rows: db.prepare(s).all(...params) };
    }

    db.prepare(s).run(...params);
    return { rows: [] };
  };
}

// ── Schema init (runs on startup) ────────────────────────────────────────────
async function initializeDb() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    user_id INTEGER,
    color TEXT DEFAULT '#6B7280',
    icon TEXT DEFAULT '📦'
  )`);

  await query(`CREATE TABLE IF NOT EXISTS spending_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    category_id INTEGER,
    receipt_path TEXT,
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  const { rows } = await query('SELECT COUNT(*) as count FROM categories WHERE user_id IS NULL');
  if (parseInt(rows[0].count) === 0) {
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
    for (const [name, color, icon] of seed) {
      await query(
        'INSERT INTO categories (name, user_id, color, icon) VALUES ($1, NULL, $2, $3)',
        [name, color, icon]
      );
    }
  }

  console.log(`Database ready (${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'})`);
}

module.exports = { query, initializeDb };
