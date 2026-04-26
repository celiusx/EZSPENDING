const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initializeDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, cb) => {
    const allowed = [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean);
    if (!origin || allowed.includes(origin)) cb(null, true);
    else cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/spending',   require('./routes/spending'));
app.use('/api/categories', require('./routes/categories'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Serve built React app in production (Fly.io)
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../frontend-dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

initializeDb().then(() => {
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}).catch((err) => {
  console.error('DB init failed:', err.message);
  process.exit(1);
});
