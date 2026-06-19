//--------------------------------------------------------------------------
//Judges Scoring System Server
//Run command in terminal to begin: node server.js
//--------------------------------------------------------------------------


const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

//1-min edit window...........................................................
const EDIT_WINDOW_MS = 60 * 1000; 

//Database loading in........................................................
const db = new sqlite3.Database('./judges.db');

//The Categories for grading the contestants.................................
const seedCategories = [
  ['swara', 'Swara', 'Pitch accuracy and note clarity'],
  ['taal', 'Taal', 'Rhythm and timing precision'],
  ['bhava', 'Bhava', 'Expression and emotional delivery'],
  ['complex', 'Complex', 'Technical difficulty and execution'],
  ['pronounce', 'Pronounce', 'Pronunciation clarity and diction']
];

db.serialize(() => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, desc)
    VALUES (?, ?, ?)
  `);

  seedCategories.forEach(c => stmt.run(c[0], c[1], c[2]));

  stmt.finalize();
});



//Foreign Keys and making tables....................................................
db.run(`PRAGMA foreign_keys = ON;`);


db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS judges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contestants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contestant_number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      desc TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      judge_id INTEGER NOT NULL,
      contestant_id INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      score INTEGER NOT NULL CHECK(score >= 0 AND score <= 10),
      submitted_at INTEGER,
      PRIMARY KEY (judge_id, contestant_id, category_id),
      FOREIGN KEY (judge_id) REFERENCES judges(id),
      FOREIGN KEY (contestant_id) REFERENCES contestants(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

});


//MIDDLEWARE -----------------------------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(__dirname));


//Login process .......................................................................................................................
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    `SELECT id, name FROM judges WHERE username = ? AND password = ? AND is_admin = 0`,
    [username, password],
    (err, judge) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!judge) return res.status(401).json({ error: 'Error: The entered Username or Password is incorrect! Please try again.' });

      res.json({
        ok: true,
        judgeId: judge.id,
        judgeName: judge.name
      });
    }
  );
});


//Config purposes (Terminal indication) ------------------------------------------------------------------------------------------------------
app.get('/api/config', (req, res) => {

  db.all(`SELECT id, name, desc FROM categories`, [], (err, categories) => {

    if (err) {
      console.error("CATEGORIES ERROR:", err);
      return res.status(500).json({ error: err.message });
    }

    console.log("Categories OK:", categories.length);

    db.all(`
      SELECT id, contestant_number, name
      FROM contestants
      ORDER BY contestant_number
    `, [], (err2, contestants) => {

      if (err2) {
        console.error("CONTESTANTS ERROR:", err2);
        return res.status(500).json({ error: err2.message });
      }

      console.log("Contestants OK:", contestants.length);

      res.json({
        categories,
        contestants,
        editWindowMs: EDIT_WINDOW_MS
      });

    });

  });

});


//Getting the scores.........................................................................................................
app.post('/api/scores/mine', (req, res) => {

  const { judgeId } = req.body;

  db.all(
    `
    SELECT contestant_id, category_id, score, submitted_at
    FROM scores
    WHERE judge_id = ?
    `,
    [judgeId],
    (err, rows) => {

      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const result = {};

      rows.forEach(r => {

        if (!result[r.contestant_id]) {
          result[r.contestant_id] = {
            scores: {},
            submittedAt: null
          };
        }

        result[r.contestant_id].scores[r.category_id] = r.score;
        result[r.contestant_id].submittedAt = r.submitted_at;

      });

      res.json(result);

    }
  );

});


//Submitting the scores as a judge logic......................................................................................
app.post('/api/scores/submit', (req, res) => {

  const {
    judgeId,
    contestantId,
    scores
  } = req.body;

  const now = Date.now();

  //1-min Locked scores check...
  db.get(
    `
    SELECT submitted_at
    FROM scores
    WHERE judge_id = ?
      AND contestant_id = ?
    LIMIT 1
    `,
    [judgeId, contestantId],
    (err, existing) => {

      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const submittedAt = existing?.submitted_at || now;
      const locked =
        existing &&
        (now - existing.submitted_at >= EDIT_WINDOW_MS);

      if (locked) {
        return res.status(403).json({
          error: 'Edit window has closed'
        });
      }

      const stmt = db.prepare(`
        INSERT INTO scores
        (judge_id, contestant_id, category_id, score, submitted_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(judge_id, contestant_id, category_id)
        DO UPDATE SET
          score = excluded.score,
          submitted_at = excluded.submitted_at
      `);

      db.serialize(() => {

        for (const [catId, score] of Object.entries(scores)) {

          stmt.run(
            judgeId,
            contestantId,
            catId,
            score,
            submittedAt
          );

        }

      });

      res.json({
        ok: true,
        submittedAt,
        locked: false
      });

    }
  );

});


//Admin results view..............................................................................................................
app.post('/api/results', (req, res) => {
  
  db.all(`SELECT id, name FROM judges WHERE is_admin = 0`, [], (err, judges) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    db.all(`SELECT id, contestant_number, name FROM contestants ORDER BY contestant_number`, [], (err, contestants) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      db.all(`SELECT id, name FROM categories`, [], (err, categories) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        db.all(`SELECT judge_id, contestant_id, category_id, score FROM scores`, [], (err, rows) => {

          if (err) return res.status(500).json({ error: 'Database error' });
          const scoresMap = {};

          rows.forEach(r => {
            if (!scoresMap[r.contestant_id]) scoresMap[r.contestant_id] = {};
            if (!scoresMap[r.contestant_id][r.judge_id]) scoresMap[r.contestant_id][r.judge_id] = {};
            scoresMap[r.contestant_id][r.judge_id][r.category_id] = r.score;
          });

          res.json({ judges, contestants, categories, scoresMap });
        });
      });
    });
  });
});


//Admin Login and perms ------------------------------------------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    `SELECT id, name FROM judges WHERE username = ? AND password = ? AND is_admin = 1`,
    [username, password],
    (err, judge) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!judge) return res.status(401).json({ error: 'Invalid admin credentials' });
      res.json({ ok: true, adminName: judge.name });
    }
  );
});



//Starting the server ------------------------------------------------------------------------------------------------------------
app.listen(PORT, () => {

  console.log(`\n Judges system running at http://localhost:${PORT}`);
  console.log(`Database: judges.db`);
  console.log(`Edit window: ${EDIT_WINDOW_MS / 1000}s`);

});



