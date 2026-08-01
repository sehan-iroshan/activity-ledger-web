const express = require('express');
const store = require('../lib/store');
const { requireAuth } = require('../lib/middleware');

const router = express.Router();
router.use(requireAuth);

// bucket: 0 Pending (Open), 1 Incomplete (In Progress / On Hold), 2 Complete, 3 Cancelled
function bucketOf(status) {
  switch (status) {
    case 'Open': return 0;
    case 'Completed': return 2;
    case 'Cancelled': return 3;
    case 'In Progress':
    case 'On Hold':
    default: return 1;
  }
}

function bump(map, key) {
  if (!map[key]) map[key] = [0, 0, 0, 0];
  return map[key];
}

router.get('/', (req, res) => {
  const all = store.loadActivities();
  const totals = { total: all.length, pending: 0, incomplete: 0, complete: 0, cancelled: 0 };
  const byProject = {};
  const byUser = {};

  for (const r of all) {
    const bucket = bucketOf(r.status);
    if (bucket === 0) totals.pending++;
    else if (bucket === 1) totals.incomplete++;
    else if (bucket === 2) totals.complete++;
    else totals.cancelled++;

    const project = r.projectName && r.projectName.trim() ? r.projectName.trim() : '(No Project)';
    bump(byProject, project)[bucket]++;

    const user = r.createdBy && r.createdBy.trim() ? r.createdBy.trim() : '(Unknown)';
    bump(byUser, user)[bucket]++;
  }

  const toRows = map => Object.entries(map).map(([name, c]) => ({
    name, total: c[0] + c[1] + c[2] + c[3], pending: c[0], incomplete: c[1], complete: c[2], cancelled: c[3]
  }));

  res.json({ totals, byProject: toRows(byProject), byUser: toRows(byUser) });
});

module.exports = router;
