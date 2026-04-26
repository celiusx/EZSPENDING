const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'ezspending_secret_key';

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });

  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
