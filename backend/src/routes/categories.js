const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const cats = db.prepare(
    'SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY name'
  ).all(req.user.id);
  res.json(cats);
});

router.post('/', auth, (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(
    'INSERT INTO categories (name, user_id, color, icon) VALUES (?, ?, ?, ?)'
  ).run(name, req.user.id, color || '#6B7280', icon || '📦');

  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
});

module.exports = router;
