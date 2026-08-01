const STATUS_OPTIONS = ['Open', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
const DELIVERY_OPTIONS = ['Pending', 'Delivered', 'Delayed', 'Not Applicable'];

const STATUS_COLOR = {
  'Open': 'var(--status-open)',
  'In Progress': 'var(--status-in-progress)',
  'Completed': 'var(--status-completed)',
  'On Hold': 'var(--status-on-hold)',
  'Cancelled': 'var(--status-cancelled)'
};
const DELIVERY_COLOR = {
  'Pending': 'var(--delivery-pending)',
  'Delivered': 'var(--delivery-delivered)',
  'Delayed': 'var(--delivery-delayed)',
  'Not Applicable': 'var(--delivery-na)'
};

let currentUser = null;
let selectedRecordId = null;
let currentRegisterRows = [];

// ---------------- API helper ----------------
async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
  return data;
}

// ---------------- Boot ----------------
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('login-year').textContent = new Date().getFullYear();
  document.getElementById('login-date').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  wireLoginScreen();
  wireNewEntry();
  wireRegister();
  wireProfile();
  wireDashboard();

  try {
    const { user } = await api('/auth/session');
    if (user) { currentUser = user; showApp(); }
    else { showLogin(); }
  } catch (e) {
    showLogin();
  }
});

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  buildSidebar();
  document.getElementById('sidebar-username').textContent = currentUser.fullName;
  document.getElementById('sidebar-role').textContent = currentUser.username + ' \u00b7 ' + currentUser.role;
  switchView(0);
}

// ---------------- Login ----------------
function wireLoginScreen() {
  const doLogin = async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';
    if (!username || !password) { errEl.textContent = 'Please enter username and password.'; return; }
    try {
      const { user } = await api('/auth/login', 'POST', { username, password });
      currentUser = user;
      document.getElementById('login-password').value = '';
      showApp();
    } catch (e) {
      errEl.textContent = e.message;
    }
  };
  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('login-username').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

// ---------------- Sidebar ----------------
const VIEW_IDS = ['view-dashboard', 'view-new-entry', 'view-register', 'view-profile'];

function buildSidebar() {
  const isAdmin = currentUser.role === 'Admin';
  const labels = ['Dashboard', 'New Entry', 'Register', isAdmin ? 'Manage Users' : 'My Profile'];
  const nav = document.getElementById('nav-rows');
  nav.innerHTML = '';
  labels.forEach((label, i) => {
    const row = document.createElement('div');
    row.className = 'nav-row' + (i === 0 ? ' active' : '');
    row.textContent = label;
    row.addEventListener('click', () => switchView(i));
    nav.appendChild(row);
  });

  document.getElementById('profile-eyebrow').textContent = isAdmin ? 'Access control' : 'Account';
  document.getElementById('profile-title').textContent = isAdmin ? 'Manage Users' : 'My Profile';
  document.getElementById('admin-users-panel').classList.toggle('hidden', !isAdmin);
  document.getElementById('self-profile-panel').classList.toggle('hidden', isAdmin);

  document.getElementById('logout-btn').onclick = async () => {
    await api('/auth/logout', 'POST');
    currentUser = null;
    showLogin();
  };
}

function switchView(index) {
  document.querySelectorAll('.nav-row').forEach((row, i) => row.classList.toggle('active', i === index));
  VIEW_IDS.forEach((id, i) => document.getElementById(id).classList.toggle('hidden', i !== index));
  if (index === 0) loadDashboard();
  if (index === 1) loadProjectList();
  if (index === 2) loadRegister();
  if (index === 3 && currentUser.role === 'Admin') loadUsers();
  if (index === 3 && currentUser.role !== 'Admin') loadSelfProfile();
}

// ---------------- Dashboard ----------------
function wireDashboard() {
  document.getElementById('dash-refresh').addEventListener('click', loadDashboard);
}

async function loadDashboard() {
  const { totals, byProject, byUser } = await api('/dashboard');

  const statRow = document.getElementById('stat-row');
  statRow.innerHTML = '';
  const stats = [
    ['Total Entries', totals.total, 'var(--ink-navy)'],
    ['Pending', totals.pending, 'var(--status-open)'],
    ['Incomplete', totals.incomplete, 'var(--status-in-progress)'],
    ['Complete', totals.complete, 'var(--status-completed)'],
    ['Cancelled', totals.cancelled, 'var(--status-cancelled)']
  ];
  stats.forEach(([label, value, color]) => {
    const div = document.createElement('div');
    div.className = 'stat-card';
    div.innerHTML = `<div class="stat-bar" style="background:${color}"></div>
      <div class="stat-value">${value}</div>
      <div class="eyebrow">${label}</div>`;
    statRow.appendChild(div);
  });

  renderBreakdownTable('project-table', byProject);
  renderBreakdownTable('user-table', byUser);
}

function renderBreakdownTable(tableId, rows) {
  const table = document.getElementById(tableId);
  const cols = ['Name', 'Total', 'Pending', 'Incomplete', 'Complete', 'Cancelled'];
  table.querySelector('thead').innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  const data = rows.length ? rows : [{ name: 'No entries yet', total: 0, pending: 0, incomplete: 0, complete: 0, cancelled: 0 }];
  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(r.name)}</td><td>${r.total}</td><td>${r.pending}</td><td>${r.incomplete}</td><td>${r.complete}</td><td>${r.cancelled}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------------- New Entry ----------------
function wireNewEntry() {
  const statusSel = document.getElementById('f-status');
  const deliverySel = document.getElementById('f-delivery');
  STATUS_OPTIONS.forEach(s => statusSel.appendChild(new Option(s, s)));
  DELIVERY_OPTIONS.forEach(s => deliverySel.appendChild(new Option(s, s)));

  document.getElementById('save-entry-btn').addEventListener('click', saveEntry);

  tickClock();
  setInterval(tickClock, 1000);
}

function tickClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  document.getElementById('entry-stamp-date').textContent = dateIso.substring(5).replace('-', '/');
  document.getElementById('entry-stamp-time').textContent = time;
  document.getElementById('entry-clock').textContent = now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadProjectList() {
  const { projects } = await api('/activities/projects');
  const list = document.getElementById('project-list');
  list.innerHTML = '';
  projects.forEach(p => list.appendChild(new Option(p, p)));
}

async function saveEntry() {
  const activity = document.getElementById('f-activity').value.trim();
  const requester = document.getElementById('f-requester').value.trim();
  if (!activity) { alert('Please enter an activity name.'); return; }
  if (!requester) { alert('Please enter the requester.'); return; }

  const body = {
    projectName: document.getElementById('f-project').value.trim(),
    activity,
    description: document.getElementById('f-description').value.trim(),
    status: document.getElementById('f-status').value,
    deliveryStatus: document.getElementById('f-delivery').value,
    requester
  };

  try {
    const { record } = await api('/activities', 'POST', body);
    document.getElementById('f-project').value = '';
    document.getElementById('f-activity').value = '';
    document.getElementById('f-description').value = '';
    document.getElementById('f-requester').value = '';
    document.getElementById('f-status').selectedIndex = 0;
    document.getElementById('f-delivery').selectedIndex = 0;
    loadProjectList();
    alert('Entry #' + record.id + ' stamped and saved to the ledger.');
  } catch (e) {
    alert(e.message);
  }
}

// ---------------- Register ----------------
function wireRegister() {
  document.getElementById('reg-refresh').addEventListener('click', loadRegister);
  document.getElementById('s-search').addEventListener('click', loadRegister);
  document.getElementById('s-clear').addEventListener('click', () => {
    ['s-from', 's-to', 's-project', 's-requester', 's-loggedby'].forEach(id => document.getElementById(id).value = '');
    loadRegister();
  });
  ['s-from', 's-to', 's-project', 's-requester', 's-loggedby'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') loadRegister(); });
  });
  document.getElementById('reg-export').addEventListener('click', exportCsv);
  document.getElementById('reg-amend').addEventListener('click', amendSelected);
  document.getElementById('reg-delete').addEventListener('click', deleteSelected);
}

function currentFilterQuery() {
  return {
    from: document.getElementById('s-from').value.trim(),
    to: document.getElementById('s-to').value.trim(),
    project: document.getElementById('s-project').value.trim(),
    requester: document.getElementById('s-requester').value.trim(),
    loggedBy: document.getElementById('s-loggedby').value.trim()
  };
}

async function loadRegister() {
  const q = currentFilterQuery();
  const params = new URLSearchParams(q);
  const { total, records } = await api('/activities?' + params.toString());
  currentRegisterRows = records;

  const filtering = Object.values(q).some(v => v);
  document.getElementById('register-count').textContent = records.length + (records.length === 1 ? ' entry' : ' entries')
    + (filtering ? ` matching search (of ${total} total)` : ' recorded');

  const table = document.getElementById('register-table');
  const cols = ['ID', 'Date', 'Time', 'Project', 'Activity', 'Description', 'Status', 'Requester', 'Delivery', 'Logged By'];
  table.querySelector('thead').innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';

  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    const preview = (r.description || '').replace(/\\n/g, ' ').replace(/\r?\n/g, ' ');
    tr.innerHTML = `<td>${r.id}</td><td>${esc(r.date)}</td><td>${esc(r.time)}</td><td>${esc(r.projectName)}</td>
      <td>${esc(r.activity)}</td><td>${esc(preview)}</td>
      <td><span class="badge" style="background:${STATUS_COLOR[r.status] || '#999'}">${esc(r.status)}</span></td>
      <td>${esc(r.requester)}</td>
      <td><span class="badge" style="background:${DELIVERY_COLOR[r.deliveryStatus] || '#999'}">${esc(r.deliveryStatus)}</span></td>
      <td>${esc(r.createdBy)}</td>`;
    tr.addEventListener('click', () => selectRow(r.id));
    tbody.appendChild(tr);
  });

  if (!records.some(r => r.id === selectedRecordId)) {
    selectRow(null);
  } else {
    highlightSelectedRow();
  }
}

function highlightSelectedRow() {
  document.querySelectorAll('#register-table tbody tr').forEach(tr => {
    tr.classList.toggle('selected', parseInt(tr.dataset.id, 10) === selectedRecordId);
  });
}

function selectRow(id) {
  selectedRecordId = id;
  highlightSelectedRow();
  const r = currentRegisterRows.find(x => x.id === id);
  document.getElementById('reg-amend').disabled = !r;
  document.getElementById('reg-delete').disabled = !r;

  if (!r) {
    document.getElementById('detail-activity').textContent = 'Select a row in the register to view its full detail.';
    document.getElementById('detail-meta').innerHTML = '&nbsp;';
    document.getElementById('detail-description').textContent = 'Full description will appear here once you select a row.';
    setBadge('detail-status-badge', null);
    setBadge('detail-delivery-badge', null);
    return;
  }

  const title = r.projectName ? `${r.projectName} \u2014 ${r.activity}` : r.activity;
  document.getElementById('detail-activity').textContent = title;
  document.getElementById('detail-meta').textContent =
    `Entry #${r.id}  \u00b7  ${r.date} ${r.time}  \u00b7  Requested by ${r.requester}  \u00b7  Logged by ${r.createdBy}`;
  const desc = (r.description || '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  document.getElementById('detail-description').textContent = desc || '(No description provided.)';
  setBadge('detail-status-badge', r.status, STATUS_COLOR);
  setBadge('detail-delivery-badge', r.deliveryStatus, DELIVERY_COLOR);
}

function setBadge(elId, value, colorMap) {
  const el = document.getElementById(elId);
  if (!value) {
    el.textContent = '\u2014';
    el.style.background = 'var(--text-muted)';
    return;
  }
  el.textContent = value;
  el.style.background = (colorMap && colorMap[value]) || '#999';
}

function exportCsv() {
  const q = currentFilterQuery();
  const params = new URLSearchParams(q);
  window.location.href = '/api/activities/export.csv?' + params.toString();
}

function amendSelected() {
  const r = currentRegisterRows.find(x => x.id === selectedRecordId);
  if (!r) return;
  openModal(`
    <h3>Amend Entry #${r.id}</h3>
    <div class="field-block">
      <label class="eyebrow">Status</label>
      <select id="m-status" class="field-select">${STATUS_OPTIONS.map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
    </div>
    <div class="field-block">
      <label class="eyebrow">Delivery Status</label>
      <select id="m-delivery" class="field-select">${DELIVERY_OPTIONS.map(s => `<option ${s === r.deliveryStatus ? 'selected' : ''}>${s}</option>`).join('')}</select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="m-cancel">Cancel</button>
      <button class="btn btn-primary" id="m-ok">Save</button>
    </div>
  `, () => {
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    document.getElementById('m-ok').addEventListener('click', async () => {
      try {
        await api('/activities/' + r.id, 'PUT', {
          status: document.getElementById('m-status').value,
          deliveryStatus: document.getElementById('m-delivery').value
        });
        closeModal();
        loadRegister();
      } catch (e) { alert(e.message); }
    });
  });
}

function deleteSelected() {
  const r = currentRegisterRows.find(x => x.id === selectedRecordId);
  if (!r) return;
  if (!confirm(`Delete entry #${r.id} ("${r.activity}")?\nThis cannot be undone.`)) return;
  api('/activities/' + r.id, 'DELETE').then(() => {
    selectedRecordId = null;
    loadRegister();
  }).catch(e => alert(e.message));
}

// ---------------- Profile / Manage Users ----------------
function wireProfile() {
  document.getElementById('user-add').addEventListener('click', openAddUserModal);
  document.getElementById('user-reset-pw').addEventListener('click', openResetPasswordModal);
  document.getElementById('user-delete').addEventListener('click', deleteSelectedUser);
  document.getElementById('user-change-my-pw').addEventListener('click', openChangeMyPasswordModal);
  document.getElementById('self-change-pw').addEventListener('click', openChangeMyPasswordModal);
}

let selectedUsername = null;

async function loadUsers() {
  const { users } = await api('/users');
  const table = document.getElementById('users-table');
  table.querySelector('thead').innerHTML = '<tr><th>Username</th><th>Full Name</th><th>Role</th></tr>';
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(u.username)}</td><td>${esc(u.fullName)}</td><td>${esc(u.role)}</td>`;
    tr.addEventListener('click', () => {
      selectedUsername = u.username;
      tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
      tr.classList.add('selected');
    });
    tbody.appendChild(tr);
  });
}

async function loadSelfProfile() {
  document.getElementById('me-username').textContent = currentUser.username;
  document.getElementById('me-fullname').textContent = currentUser.fullName;
  document.getElementById('me-role').textContent = currentUser.role;
}

function openAddUserModal() {
  openModal(`
    <h3>Add User</h3>
    <div class="field-block"><label class="eyebrow">Username</label><input id="m-username" class="field-input"></div>
    <div class="field-block"><label class="eyebrow">Full Name</label><input id="m-fullname" class="field-input"></div>
    <div class="field-block"><label class="eyebrow">Password</label><input id="m-password" type="password" class="field-input"></div>
    <div class="field-block"><label class="eyebrow">Role</label>
      <select id="m-role" class="field-select"><option>User</option><option>Admin</option></select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="m-cancel">Cancel</button>
      <button class="btn btn-primary" id="m-ok">Add</button>
    </div>
  `, () => {
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    document.getElementById('m-ok').addEventListener('click', async () => {
      try {
        await api('/users', 'POST', {
          username: document.getElementById('m-username').value.trim(),
          fullName: document.getElementById('m-fullname').value.trim(),
          password: document.getElementById('m-password').value,
          role: document.getElementById('m-role').value
        });
        closeModal();
        loadUsers();
      } catch (e) { alert(e.message); }
    });
  });
}

function openResetPasswordModal() {
  if (!selectedUsername) { alert('Select a user first.'); return; }
  const username = selectedUsername;
  openModal(`
    <h3>New password for ${esc(username)}</h3>
    <div class="field-block"><input id="m-password" type="password" class="field-input" autofocus></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="m-cancel">Cancel</button>
      <button class="btn btn-primary" id="m-ok">Save</button>
    </div>
  `, () => {
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    document.getElementById('m-ok').addEventListener('click', async () => {
      const pw = document.getElementById('m-password').value;
      if (!pw) return;
      try {
        await api('/users/' + encodeURIComponent(username) + '/password', 'PUT', { password: pw });
        closeModal();
        alert('Password updated.');
      } catch (e) { alert(e.message); }
    });
  });
}

function deleteSelectedUser() {
  if (!selectedUsername) { alert('Select a user first.'); return; }
  if (selectedUsername.toLowerCase() === currentUser.username.toLowerCase()) {
    alert('You cannot delete the account you are logged in with.');
    return;
  }
  if (!confirm(`Delete user '${selectedUsername}'?`)) return;
  api('/users/' + encodeURIComponent(selectedUsername), 'DELETE').then(() => {
    selectedUsername = null;
    loadUsers();
  }).catch(e => alert(e.message));
}

function openChangeMyPasswordModal() {
  openModal(`
    <h3>Change My Password</h3>
    <div class="field-block"><label class="eyebrow">Current Password</label><input id="m-current" type="password" class="field-input"></div>
    <div class="field-block"><label class="eyebrow">New Password</label><input id="m-new" type="password" class="field-input"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="m-cancel">Cancel</button>
      <button class="btn btn-primary" id="m-ok">Save</button>
    </div>
  `, () => {
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    document.getElementById('m-ok').addEventListener('click', async () => {
      try {
        await api('/users/me/password', 'PUT', {
          currentPassword: document.getElementById('m-current').value,
          newPassword: document.getElementById('m-new').value
        });
        closeModal();
        alert('Your password has been updated.');
      } catch (e) { alert(e.message); }
    });
  });
}

// ---------------- Modal helper ----------------
function openModal(html, onMount) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
  if (onMount) onMount();
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-box').innerHTML = '';
}

// ---------------- Utility ----------------
function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
