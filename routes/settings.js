const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/settings  — returns all settings as a flat object
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj  = {};
    rows.forEach(r => {
      try { obj[r.key] = JSON.parse(r.value); }
      catch { obj[r.key] = r.value; }
    });
    res.json({ ok: true, settings: obj });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/settings  — body is a flat key/value object, merges with existing
router.post('/', (req, res) => {
  try {
    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `);
    const run = db.transaction((obj) => {
      for (const [k, v] of Object.entries(obj)) {
        upsert.run(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    });
    run(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
