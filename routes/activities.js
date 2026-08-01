const express = require('express');
const store = require('../lib/store');
const { requireAuth } = require('../lib/middleware');
const { STATUS_OPTIONS, DELIVERY_STATUS_OPTIONS } = require('../lib/constants');

const router = express.Router();
router.use(requireAuth);

function normalizeDescription(text) {
  // Convert any literal backslash-n typed by a user into a real line break,
  // so it always displays and exports line-by-line instead of as "\n" text.
  if (!text) return '';
  return String(text).replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

function matchesFilters(r, q) {
  if (q.from && r.date < q.from) return false;
  if (q.to && r.date > q.to) return false;
  if (q.project && !(r.projectName || '').toLowerCase().includes(q.project)) return false;
  if (q.requester && !(r.requester || '').toLowerCase().includes(q.requester)) return false;
  if (q.loggedBy && !(r.createdBy || '').toLowerCase().includes(q.loggedBy)) return false;
  return true;
}

router.get('/', (req, res) => {
  const q = {
    from: (req.query.from || '').trim(),
    to: (req.query.to || '').trim(),
    project: (req.query.project || '').trim().toLowerCase(),
    requester: (req.query.requester || '').trim().toLowerCase(),
    loggedBy: (req.query.loggedBy || '').trim().toLowerCase()
  };
  const all = store.loadActivities();
  const filtered = all.filter(r => matchesFilters(r, q));
  res.json({ total: all.length, records: filtered });
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const activity = (b.activity || '').trim();
  const requester = (b.requester || '').trim();
  if (!activity) return res.status(400).json({ error: 'Activity is required.' });
  if (!requester) return res.status(400).json({ error: 'Requester is required.' });

  const status = STATUS_OPTIONS.includes(b.status) ? b.status : STATUS_OPTIONS[0];
  const deliveryStatus = DELIVERY_STATUS_OPTIONS.includes(b.deliveryStatus) ? b.deliveryStatus : DELIVERY_STATUS_OPTIONS[0];
  const projectName = (b.projectName || '').trim();

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const records = store.loadActivities();
  const record = {
    id: store.nextActivityId(),
    date, time,
    activity,
    projectName,
    description: normalizeDescription(b.description),
    status,
    requester,
    deliveryStatus,
    createdBy: req.session.user.username
  };
  records.push(record);
  store.saveActivities(records);
  store.rememberProjectName(projectName);

  res.status(201).json({ record });
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const records = store.loadActivities();
  const target = records.find(r => r.id === id);
  if (!target) return res.status(404).json({ error: 'Entry not found.' });

  const b = req.body || {};
  if (b.status !== undefined) {
    if (!STATUS_OPTIONS.includes(b.status)) return res.status(400).json({ error: 'Invalid status.' });
    target.status = b.status;
  }
  if (b.deliveryStatus !== undefined) {
    if (!DELIVERY_STATUS_OPTIONS.includes(b.deliveryStatus)) return res.status(400).json({ error: 'Invalid delivery status.' });
    target.deliveryStatus = b.deliveryStatus;
  }
  store.saveActivities(records);
  res.json({ record: target });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const records = store.loadActivities();
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Entry not found.' });
  records.splice(idx, 1);
  store.saveActivities(records);
  res.json({ ok: true });
});

function csvField(value) {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

router.get('/export.csv', (req, res) => {
  const q = {
    from: (req.query.from || '').trim(),
    to: (req.query.to || '').trim(),
    project: (req.query.project || '').trim().toLowerCase(),
    requester: (req.query.requester || '').trim().toLowerCase(),
    loggedBy: (req.query.loggedBy || '').trim().toLowerCase()
  };
  const records = store.loadActivities().filter(r => matchesFilters(r, q));

  const header = ['ID', 'Date', 'Time', 'Project', 'Activity', 'Description', 'Status', 'Requester', 'Delivery Status', 'Logged By'];
  const lines = [header.map(csvField).join(',')];
  for (const r of records) {
    lines.push([
      r.id, r.date, r.time, r.projectName, r.activity,
      normalizeDescription(r.description), r.status, r.requester, r.deliveryStatus, r.createdBy
    ].map(csvField).join(','));
  }
  const csv = lines.join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="activity_register_${Date.now()}.csv"`);
  res.send('\uFEFF' + csv); // BOM so Excel opens UTF-8 correctly
});

router.get('/projects', (req, res) => {
  res.json({ projects: store.loadProjectNames() });
});

module.exports = router;
