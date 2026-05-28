const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/users
router.get('/', (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, role, sig_data, created_at FROM users ORDER BY name').all();
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/users  (create or update by name)
router.post('/', (req, res) => {
  try {
    const { name, role, sig_data } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });
    db.prepare(`
      INSERT INTO users (name, role, sig_data)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET role=excluded.role, sig_data=excluded.sig_data
    `).run(name, role || 'Operator', sig_data || '');
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/users/sync  (replace entire user list)
router.post('/sync', (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users)) return res.status(400).json({ ok: false, error: 'users array required' });
    const upsert = db.prepare(`
      INSERT INTO users (name, role, sig_data)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET role=excluded.role, sig_data=excluded.sig_data
    `);
    const run = db.transaction((us) => { for (const u of us) upsert.run(u.name, u.role||'Operator', u.sig||u.sig_data||''); });
    run(users);
    res.json({ ok: true, synced: users.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
