const express = require('express');
const store = require('../lib/store');
const { requireAuth, requireAdmin } = require('../lib/middleware');

const router = express.Router();
router.use(requireAuth);

function publicUser(u) {
  return { username: u.username, fullName: u.fullName, role: u.role };
}

router.get('/', requireAdmin, (req, res) => {
  res.json({ users: store.loadUsers().map(publicUser) });
});

router.post('/', requireAdmin, (req, res) => {
  const b = req.body || {};
  const username = (b.username || '').trim();
  const password = b.password || '';
  const fullName = (b.fullName || '').trim();
  const role = b.role === 'Admin' ? 'Admin' : 'User';

  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  if (store.findUser(username)) return res.status(409).json({ error: 'That username already exists.' });

  const users = store.loadUsers();
  users.push({ username, passwordHash: store.hashPassword(password), fullName, role });
  store.saveUsers(users);
  res.status(201).json({ user: { username, fullName, role } });
});

router.delete('/:username', requireAdmin, (req, res) => {
  const username = req.params.username;
  if (username.toLowerCase() === req.session.user.username.toLowerCase()) {
    return res.status(400).json({ error: 'You cannot delete the account you are logged in with.' });
  }
  const users = store.loadUsers();
  const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return res.status(404).json({ error: 'User not found.' });
  users.splice(idx, 1);
  store.saveUsers(users);
  res.json({ ok: true });
});

router.put('/:username/password', requireAdmin, (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'New password is required.' });
  const users = store.loadUsers();
  const target = users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found.' });
  target.passwordHash = store.hashPassword(password);
  store.saveUsers(users);
  res.json({ ok: true });
});

// Any signed-in user can change their own password.
router.put('/me/password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword) return res.status(400).json({ error: 'New password is required.' });
  const users = store.loadUsers();
  const me = users.find(u => u.username.toLowerCase() === req.session.user.username.toLowerCase());
  if (!me || !store.verifyPassword(currentPassword || '', me.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  me.passwordHash = store.hashPassword(newPassword);
  store.saveUsers(users);
  res.json({ ok: true });
});

module.exports = router;
