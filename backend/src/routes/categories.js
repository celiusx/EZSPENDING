const express = require('express');
const auth = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM categories WHERE user_id IS NULL OR user_id = $1 ORDER BY name',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

router.post('/', auth, async (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const { rows } = await query(
      'INSERT INTO categories (name, user_id, color, icon) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, req.user.id, color || '#6B7280', icon || '📦']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

module.exports = router;
