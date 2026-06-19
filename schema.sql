CREATE TABLE judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE contestants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contestant_number INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE scores (
    judge_id INTEGER NOT NULL,
    contestant_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK(score >= 0 AND score <= 10),
    submitted_at INTEGER,

    PRIMARY KEY (
        judge_id,
        contestant_id,
        category_id
    ),

    FOREIGN KEY (judge_id) REFERENCES judges(id),
    FOREIGN KEY (contestant_id) REFERENCES contestants(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);











