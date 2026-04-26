const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|pdf/.test(path.extname(file.originalname).toLowerCase()) &&
                /image\/(jpeg|jpg|png|gif)|application\/pdf/.test(file.mimetype);
    cb(null, ok);
  },
});

// ── Summary (must be before /:id) ────────────────────────────────────────────
router.get('/summary', auth, (req, res) => {
  const userId = req.user.id;
  const now = new Date();

  const today = now.toISOString().split('T')[0];
  const dayOfWeek = now.getDay();
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMon);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const yearStr = String(now.getFullYear());

  const periodTotals = (filter, ...params) =>
    db.prepare(`SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count
                FROM spending_records WHERE user_id = ? ${filter}`).get(userId, ...params);

  const summary = {
    daily:   periodTotals(`AND date(recorded_at) = ?`, today),
    weekly:  periodTotals(`AND date(recorded_at) >= ?`, weekStartStr),
    monthly: periodTotals(`AND strftime('%Y-%m', recorded_at) = ?`, monthStr),
    yearly:  periodTotals(`AND strftime('%Y', recorded_at) = ?`, yearStr),
  };

  // Chart data
  const dailyChart = db.prepare(`
    SELECT strftime('%H:00', recorded_at) as hour, COALESCE(SUM(amount),0) as total
    FROM spending_records WHERE user_id = ? AND date(recorded_at) = date('now')
    GROUP BY strftime('%H', recorded_at) ORDER BY hour`).all(userId);

  const weeklyChart = db.prepare(`
    SELECT date(recorded_at) as date, COALESCE(SUM(amount),0) as total
    FROM spending_records WHERE user_id = ? AND date(recorded_at) >= date('now','-6 days')
    GROUP BY date(recorded_at) ORDER BY date`).all(userId);

  const monthlyChart = db.prepare(`
    SELECT date(recorded_at) as date, COALESCE(SUM(amount),0) as total
    FROM spending_records WHERE user_id = ? AND strftime('%Y-%m', recorded_at) = strftime('%Y-%m','now')
    GROUP BY date(recorded_at) ORDER BY date`).all(userId);

  const yearlyChart = db.prepare(`
    SELECT strftime('%Y-%m', recorded_at) as month, COALESCE(SUM(amount),0) as total
    FROM spending_records WHERE user_id = ? AND strftime('%Y', recorded_at) = strftime('%Y','now')
    GROUP BY strftime('%Y-%m', recorded_at) ORDER BY month`).all(userId);

  const catBreakdown = (filter, ...params) =>
    db.prepare(`
      SELECT c.name, c.color, c.icon, COALESCE(SUM(sr.amount),0) as total, COUNT(sr.id) as count
      FROM spending_records sr JOIN categories c ON sr.category_id = c.id
      WHERE sr.user_id = ? ${filter}
      GROUP BY c.id ORDER BY total DESC`).all(userId, ...params);

  const categories = {
    daily:   catBreakdown(`AND date(sr.recorded_at) = ?`, today),
    weekly:  catBreakdown(`AND date(sr.recorded_at) >= ?`, weekStartStr),
    monthly: catBreakdown(`AND strftime('%Y-%m', sr.recorded_at) = ?`, monthStr),
    yearly:  catBreakdown(`AND strftime('%Y', sr.recorded_at) = ?`, yearStr),
  };

  const recent = db.prepare(`
    SELECT sr.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
    WHERE sr.user_id = ? ORDER BY sr.recorded_at DESC LIMIT 10`).all(userId);

  res.json({ summary, dailyChart, weeklyChart, monthlyChart, yearlyChart, categories, recent });
});

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { period, page = 1, limit = 20, category_id } = req.query;
  const userId = req.user.id;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const periodFilters = {
    daily:   `AND date(sr.recorded_at) = '${today}'`,
    weekly:  `AND date(sr.recorded_at) >= date('now','-6 days')`,
    monthly: `AND strftime('%Y-%m', sr.recorded_at) = '${monthStr}'`,
    yearly:  `AND strftime('%Y', sr.recorded_at) = '${now.getFullYear()}'`,
  };
  const dateFilter = periodFilters[period] || '';
  const catFilter  = category_id ? `AND sr.category_id = ${parseInt(category_id)}` : '';

  const records = db.prepare(`
    SELECT sr.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
    WHERE sr.user_id = ? ${dateFilter} ${catFilter}
    ORDER BY sr.recorded_at DESC LIMIT ? OFFSET ?`).all(userId, parseInt(limit), offset);

  const { count } = db.prepare(
    `SELECT COUNT(*) as count FROM spending_records sr WHERE sr.user_id = ? ${dateFilter} ${catFilter}`
  ).get(userId);

  res.json({ records, total: count, page: parseInt(page), limit: parseInt(limit) });
});

// ── Single record ─────────────────────────────────────────────────────────────
router.get('/:id', auth, (req, res) => {
  const record = db.prepare(`
    SELECT sr.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
    WHERE sr.id = ? AND sr.user_id = ?`).get(req.params.id, req.user.id);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  res.json(record);
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', auth, upload.single('receipt'), (req, res) => {
  const { amount, description, category_id, recorded_at } = req.body;
  if (!amount || !recorded_at)
    return res.status(400).json({ error: 'Amount and date/time are required' });

  const result = db.prepare(`
    INSERT INTO spending_records (user_id, amount, description, category_id, receipt_path, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    req.user.id, parseFloat(amount), description || null,
    category_id || null, req.file?.filename || null, recorded_at
  );

  const record = db.prepare(`
    SELECT sr.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
    WHERE sr.id = ?`).get(result.lastInsertRowid);

  res.status(201).json(record);
});

// ── Update ────────────────────────────────────────────────────────────────────
router.put('/:id', auth, upload.single('receipt'), (req, res) => {
  const existing = db.prepare('SELECT * FROM spending_records WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Record not found' });

  const { amount, description, category_id, recorded_at } = req.body;
  const receiptPath = req.file ? req.file.filename : existing.receipt_path;

  db.prepare(`UPDATE spending_records SET amount=?, description=?, category_id=?, receipt_path=?, recorded_at=?
              WHERE id = ? AND user_id = ?`).run(
    amount !== undefined ? parseFloat(amount) : existing.amount,
    description !== undefined ? description : existing.description,
    category_id !== undefined ? category_id : existing.category_id,
    receiptPath,
    recorded_at || existing.recorded_at,
    req.params.id, req.user.id
  );

  const record = db.prepare(`
    SELECT sr.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
    WHERE sr.id = ?`).get(req.params.id);
  res.json(record);
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT * FROM spending_records WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Record not found' });

  if (existing.receipt_path) {
    const fp = path.join(uploadDir, existing.receipt_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  db.prepare('DELETE FROM spending_records WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
