const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { query } = require('../db');

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
    const ok = /jpeg|jpg|png|gif|pdf/.test(path.extname(file.originalname).toLowerCase());
    cb(null, ok);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const toNum  = (v) => parseFloat(v) || 0;
const toInt  = (v) => parseInt(v)   || 0;

const PERIOD_FILTERS = {
  daily:   `AND sr.recorded_at::date = CURRENT_DATE`,
  weekly:  `AND sr.recorded_at::date >= DATE_TRUNC('week', CURRENT_DATE)`,
  monthly: `AND TO_CHAR(sr.recorded_at,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')`,
  yearly:  `AND EXTRACT(YEAR FROM sr.recorded_at) = EXTRACT(YEAR FROM CURRENT_DATE)`,
};

// ── Summary ───────────────────────────────────────────────────────────────────
router.get('/summary', auth, async (req, res) => {
  const uid = req.user.id;

  try {
    const periodTotal = async (filter) => {
      const { rows } = await query(
        `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS count
         FROM spending_records WHERE user_id = $1 ${filter.replace(/sr\./g, '')}`,
        [uid]
      );
      return { total: toNum(rows[0].total), count: rows[0].count };
    };

    const catBreakdown = async (filter) => {
      const { rows } = await query(
        `SELECT c.name, c.color, c.icon,
                COALESCE(SUM(sr.amount),0)::float AS total,
                COUNT(sr.id)::int AS count
         FROM spending_records sr
         JOIN categories c ON sr.category_id = c.id
         WHERE sr.user_id = $1 ${filter}
         GROUP BY c.id, c.name, c.color, c.icon
         ORDER BY total DESC`,
        [uid]
      );
      return rows;
    };

    const [daily, weekly, monthly, yearly] = await Promise.all([
      periodTotal(`AND recorded_at::date = CURRENT_DATE`),
      periodTotal(`AND recorded_at::date >= DATE_TRUNC('week', CURRENT_DATE)`),
      periodTotal(`AND TO_CHAR(recorded_at,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')`),
      periodTotal(`AND EXTRACT(YEAR FROM recorded_at) = EXTRACT(YEAR FROM CURRENT_DATE)`),
    ]);

    const [
      dailyChartRows, weeklyChartRows, monthlyChartRows, yearlyChartRows,
      catDaily, catWeekly, catMonthly, catYearly, recentRows,
    ] = await Promise.all([
      // Daily chart: today by hour
      query(
        `SELECT TO_CHAR(recorded_at,'HH24:00') AS hour,
                COALESCE(SUM(amount),0)::float AS total
         FROM spending_records WHERE user_id=$1 AND recorded_at::date=CURRENT_DATE
         GROUP BY TO_CHAR(recorded_at,'HH24') ORDER BY hour`,
        [uid]
      ),
      // Weekly chart: last 7 days
      query(
        `SELECT recorded_at::date::text AS date,
                COALESCE(SUM(amount),0)::float AS total
         FROM spending_records WHERE user_id=$1
         AND recorded_at::date >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY recorded_at::date ORDER BY date`,
        [uid]
      ),
      // Monthly chart: current month by day
      query(
        `SELECT recorded_at::date::text AS date,
                COALESCE(SUM(amount),0)::float AS total
         FROM spending_records WHERE user_id=$1
         AND TO_CHAR(recorded_at,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')
         GROUP BY recorded_at::date ORDER BY date`,
        [uid]
      ),
      // Yearly chart: current year by month
      query(
        `SELECT TO_CHAR(recorded_at,'YYYY-MM') AS month,
                COALESCE(SUM(amount),0)::float AS total
         FROM spending_records WHERE user_id=$1
         AND EXTRACT(YEAR FROM recorded_at) = EXTRACT(YEAR FROM CURRENT_DATE)
         GROUP BY TO_CHAR(recorded_at,'YYYY-MM') ORDER BY month`,
        [uid]
      ),
      catBreakdown(PERIOD_FILTERS.daily),
      catBreakdown(PERIOD_FILTERS.weekly),
      catBreakdown(PERIOD_FILTERS.monthly),
      catBreakdown(PERIOD_FILTERS.yearly),
      // Recent 10 records
      query(
        `SELECT sr.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
         FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
         WHERE sr.user_id=$1 ORDER BY sr.recorded_at DESC LIMIT 10`,
        [uid]
      ),
    ]);

    res.json({
      summary: { daily, weekly, monthly, yearly },
      dailyChart:   dailyChartRows.rows,
      weeklyChart:  weeklyChartRows.rows,
      monthlyChart: monthlyChartRows.rows,
      yearlyChart:  yearlyChartRows.rows,
      categories: {
        daily: catDaily, weekly: catWeekly, monthly: catMonthly, yearly: catYearly,
      },
      recent: recentRows.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { period, page = 1, limit = 20, category_id } = req.query;
  const uid = req.user.id;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const periodFilters = {
    daily:   `AND sr.recorded_at::date = CURRENT_DATE`,
    weekly:  `AND sr.recorded_at::date >= DATE_TRUNC('week', CURRENT_DATE)`,
    monthly: `AND TO_CHAR(sr.recorded_at,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')`,
    yearly:  `AND EXTRACT(YEAR FROM sr.recorded_at) = EXTRACT(YEAR FROM CURRENT_DATE)`,
  };
  const dateFilter = periodFilters[period] || '';
  const catFilter  = category_id && !isNaN(parseInt(category_id))
    ? `AND sr.category_id = ${parseInt(category_id)}`
    : '';

  try {
    const [records, countResult] = await Promise.all([
      query(
        `SELECT sr.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
         FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
         WHERE sr.user_id=$1 ${dateFilter} ${catFilter}
         ORDER BY sr.recorded_at DESC LIMIT $2 OFFSET $3`,
        [uid, parseInt(limit), offset]
      ),
      query(
        `SELECT COUNT(*)::int AS count FROM spending_records sr
         WHERE sr.user_id=$1 ${dateFilter} ${catFilter}`,
        [uid]
      ),
    ]);

    res.json({
      records: records.rows,
      total: countResult.rows[0].count,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load records' });
  }
});

// ── Single ────────────────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT sr.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
       WHERE sr.id=$1 AND sr.user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load record' });
  }
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', auth, upload.single('receipt'), async (req, res) => {
  const { amount, description, category_id, recorded_at } = req.body;
  if (!amount || !recorded_at)
    return res.status(400).json({ error: 'Amount and date/time are required' });

  try {
    const { rows } = await query(
      `INSERT INTO spending_records (user_id, amount, description, category_id, receipt_path, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.user.id, parseFloat(amount), description || null,
       category_id || null, req.file?.filename || null, recorded_at]
    );

    const { rows: full } = await query(
      `SELECT sr.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
       WHERE sr.id=$1`,
      [rows[0].id]
    );
    res.status(201).json(full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

// ── Update ────────────────────────────────────────────────────────────────────
router.put('/:id', auth, upload.single('receipt'), async (req, res) => {
  try {
    const existing = await query(
      'SELECT * FROM spending_records WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Record not found' });

    const old = existing.rows[0];
    const { amount, description, category_id, recorded_at } = req.body;
    const receiptPath = req.file ? req.file.filename : old.receipt_path;

    await query(
      `UPDATE spending_records SET amount=$1, description=$2, category_id=$3,
       receipt_path=$4, recorded_at=$5 WHERE id=$6 AND user_id=$7`,
      [
        amount !== undefined ? parseFloat(amount) : old.amount,
        description !== undefined ? description : old.description,
        category_id !== undefined ? category_id : old.category_id,
        receiptPath,
        recorded_at || old.recorded_at,
        req.params.id, req.user.id,
      ]
    );

    const { rows } = await query(
      `SELECT sr.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM spending_records sr LEFT JOIN categories c ON sr.category_id = c.id
       WHERE sr.id=$1`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM spending_records WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });

    if (rows[0].receipt_path) {
      const fp = path.join(uploadDir, rows[0].receipt_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    await query('DELETE FROM spending_records WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

module.exports = router;
