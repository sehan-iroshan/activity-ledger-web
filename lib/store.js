const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function ensureInit() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    const defaultAdmin = {
      username: 'admin',
      passwordHash: bcrypt.hashSync('admin123', 10),
      fullName: 'Administrator',
      role: 'Admin'
    };
    writeJson(USERS_FILE, [defaultAdmin]);
  }
  if (!fs.existsSync(ACTIVITIES_FILE)) writeJson(ACTIVITIES_FILE, []);
  if (!fs.existsSync(PROJECTS_FILE)) writeJson(PROJECTS_FILE, []);
}

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- Users ----------

function loadUsers() {
  return readJson(USERS_FILE);
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function findUser(username) {
  return loadUsers().find(u => u.username.toLowerCase() === String(username).toLowerCase()) || null;
}

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

// ---------- Activities ----------

function loadActivities() {
  return readJson(ACTIVITIES_FILE);
}

function saveActivities(records) {
  writeJson(ACTIVITIES_FILE, records);
}

function nextActivityId() {
  const records = loadActivities();
  return records.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

// ---------- Projects (remembered names) ----------

function loadProjectNames() {
  return readJson(PROJECTS_FILE).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function rememberProjectName(name) {
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const names = readJson(PROJECTS_FILE);
  if (names.some(n => n.toLowerCase() === trimmed.toLowerCase())) return;
  names.push(trimmed);
  writeJson(PROJECTS_FILE, names);
}

module.exports = {
  ensureInit,
  loadUsers, saveUsers, findUser, hashPassword, verifyPassword,
  loadActivities, saveActivities, nextActivityId,
  loadProjectNames, rememberProjectName
};
