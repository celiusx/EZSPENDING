const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/spending',   require('./routes/spending'));
app.use('/api/categories', require('./routes/categories'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
