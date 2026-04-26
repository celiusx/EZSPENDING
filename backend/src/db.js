const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const query = (sql, params) => pool.query(sql, params);

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
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    color TEXT DEFAULT '#6B7280',
    icon TEXT DEFAULT '📦'
  )`);

  await query(`CREATE TABLE IF NOT EXISTS spending_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
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

  console.log('Database ready');
}

module.exports = { query, initializeDb };
