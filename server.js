//-------------------------------------------------------------------------------------------------------------------------------------------------------------
//Judges Scoring System Server (Using better-sqlite3)
//Run in terminal: node server.js
//-------------------------------------------------------------------------------------------------------------------------------------------------------------

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const EDIT_WINDOW_MS = 60 * 1000;
const db = new Database('./judges.db');
db.pragma('foreign_keys = ON');


//Creating the tables ---------------------------------------------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS contestants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contestant_number INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    desc TEXT
  );

  CREATE TABLE IF NOT EXISTS scores (
    judge_id INTEGER NOT NULL,
    contestant_id INTEGER NOT NULL,
    category_id TEXT NOT NULL,
    score REAL NOT NULL CHECK(score >= 0 AND score <= 10),
    submitted_at INTEGER,
    PRIMARY KEY (judge_id, contestant_id, category_id),
    FOREIGN KEY (judge_id) REFERENCES judges(id),
    FOREIGN KEY (contestant_id) REFERENCES contestants(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`);


const seedCategories = [
  ['swara',     'Swara',     'Pitch accuracy and note clarity'],
  ['taal',      'Taal',      'Rhythm and timing precision'],
  ['bhava',     'Bhava',     'Expression and emotional delivery'],
  ['complex',   'Complex',   'Technical difficulty and execution'],
  ['pronounce', 'Pronounce', 'Pronunciation clarity and diction'],
];

const insertCat = db.prepare(`INSERT OR IGNORE INTO categories (id, name, desc) VALUES (?, ?, ?)`);
seedCategories.forEach(c => insertCat.run(...c));
app.use(express.json());
app.use(express.static(__dirname));

//Judge Login logic ---------------------------------------------------------------------------------------------------------------------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const judge = db.prepare(
      `SELECT id, name FROM judges WHERE username = ? AND password = ? AND is_admin = 0`
    ).get(username, password);
    if (!judge) return res.status(401).json({ error: 'Error: The entered Username or Password is incorrect! Please try again.' });
    res.json({ ok: true, judgeId: judge.id, judgeName: judge.name });
  } 
  catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});


//Admin Login Logic ----------------------------------------------------------------------------------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const judge = db.prepare(
      `SELECT id, name FROM judges WHERE username = ? AND password = ? AND is_admin = 1`
    ).get(username, password);
    if (!judge) return res.status(401).json({ error: 'Invalid admin credentials' });
    res.json({ ok: true, adminName: judge.name });
  } 
  catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});


app.get('/api/config', (req, res) => {
  try {
    const categories  = db.prepare(`SELECT id, name, desc FROM categories`).all();
    const contestants = db.prepare(`SELECT id, contestant_number, name FROM contestants ORDER BY contestant_number`).all();
    res.json({ categories, contestants, editWindowMs: EDIT_WINDOW_MS });
  } 
  catch (e) {
    res.status(500).json({ error: e.message });
  }
});


//Getting the scores -----------------------------------------------------------------------------------------------------------------------------------
app.post('/api/scores/mine', (req, res) => {
  const { judgeId } = req.body;

  try {
    const rows = db.prepare(
      `SELECT contestant_id, category_id, score, submitted_at FROM scores WHERE judge_id = ?`
    ).all(judgeId);

    const result = {};

    rows.forEach(r => {
      if (!result[r.contestant_id]) result[r.contestant_id] = { scores: {}, submittedAt: null };
      result[r.contestant_id].scores[r.category_id] = r.score;
      result[r.contestant_id].submittedAt = r.submitted_at;
    });
    res.json(result);
  } 
  catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});


//Submitting scores logic ------------------------------------------------------------------------------------------------------------------------------
app.post('/api/scores/submit', (req, res) => {
  const { judgeId, contestantId, scores } = req.body;
  const now = Date.now();

  try {
    const existing = db.prepare(
      `SELECT submitted_at FROM scores WHERE judge_id = ? AND contestant_id = ? LIMIT 1`
    ).get(judgeId, contestantId);

    const submittedAt = existing?.submitted_at || now;
    const locked = existing && (now - existing.submitted_at >= EDIT_WINDOW_MS);
    if (locked) return res.status(403).json({ error: 'Edit window has closed' });

    const upsert = db.prepare(`
      INSERT INTO scores (judge_id, contestant_id, category_id, score, submitted_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(judge_id, contestant_id, category_id)
      DO UPDATE SET score = excluded.score, submitted_at = excluded.submitted_at
    `);

    const insertMany = db.transaction((entries) => {
      for (const [catId, score] of entries) {
        upsert.run(judgeId, contestantId, catId, score, submittedAt);
      }
    });

    insertMany(Object.entries(scores));
    res.json({ ok: true, submittedAt, locked: false });
  } 
  catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});


//Admin results panel ---------------------------------------------------------------------------------------------------------------------------------------
app.post('/api/results', (req, res) => {

  try {
    const judges      = db.prepare(`SELECT id, name FROM judges WHERE is_admin = 0`).all();
    const contestants = db.prepare(`SELECT id, contestant_number, name FROM contestants ORDER BY contestant_number`).all();
    const categories  = db.prepare(`SELECT id, name FROM categories`).all();
    const rows        = db.prepare(`SELECT judge_id, contestant_id, category_id, score FROM scores`).all();

    const scoresMap = {};

    rows.forEach(r => {
      if (!scoresMap[r.contestant_id]) scoresMap[r.contestant_id] = {};
      if (!scoresMap[r.contestant_id][r.judge_id]) scoresMap[r.contestant_id][r.judge_id] = {};
      scoresMap[r.contestant_id][r.judge_id][r.category_id] = r.score;
    });

    res.json({ judges, contestants, categories, scoresMap });
  } 
  catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});


//Initiating the server ---------------------------------------------------------------------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n Judges system running at http://localhost:${PORT}`);
  console.log(`Database: judges.db`);
  console.log(`Edit window: ${EDIT_WINDOW_MS / 1000}s`);
});

