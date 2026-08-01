function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in.' });
  if (req.session.user.role !== 'Admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

module.exports = { requireAuth, requireAdmin };
