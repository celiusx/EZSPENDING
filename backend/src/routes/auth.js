const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ezspending_secret_key';

router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name, address } = req.body;
  if (!email || !password || !first_name || !last_name)
    return res.status(400).json({ error: 'Email, password, first name and last name are required' });

  try {
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
      return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (email, password, first_name, last_name, address) VALUES (?, ?, ?, ?, ?)'
    ).run(email, hashed, first_name, last_name, address || null);

    const user = { id: result.lastInsertRowid, email, first_name, last_name, address: address || null };
    const token = jwt.sign({ id: user.id, email, first_name, last_name }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, address: user.address },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
