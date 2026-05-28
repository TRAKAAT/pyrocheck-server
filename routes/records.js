const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { v4: uuidv4 } = require('uuid');

// ── GET /api/records ─────────────────────────────────────────────────────────
// Query params: date, dateFrom, dateTo, shift, type, flag, limit, offset
router.get('/', (req, res) => {
  try {
    const { date, dateFrom, dateTo, shift, type, flag, limit = 500, offset = 0 } = req.query;

    let sql  = 'SELECT * FROM records WHERE 1=1';
    const params = [];

    if (date) {
      sql += ' AND date(timestamp) = ?';
      params.push(date);
    }
    if (dateFrom) {
      sql += ' AND date(timestamp) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND date(timestamp) <= ?';
      params.push(dateTo);
    }
    if (shift) {
      sql += ' AND shift = ?';
      params.push(shift);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (flag) {
      sql += ' AND flag = ?';
      params.push(flag);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const rows = db.prepare(sql).all(...params);

    // Parse JSON fields
    const records = rows.map(r => ({
      ...r,
      smokeFlag:    !!r.smoke_flag,
      odourFlag:    !!r.odour_flag,
      compFlag:     !!r.comp_flag,
      evFlag:       !!r.ev_flag,
      requiresCoCT: !!r.requires_coct,
      backfill:     !!r.backfill,
      data:   JSON.parse(r.data_json  || '{}'),
      photos: JSON.parse(r.photos_json || '{}'),
    }));

    res.json({ ok: true, records, count: records.length });
  } catch (err) {
    console.error('GET /records error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/records ────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const r = req.body;
    if (!r || !r.timestamp || !r.type) {
      return res.status(400).json({ ok: false, error: 'timestamp and type are required' });
    }

    const id = r.id || uuidv4();

    db.prepare(`
      INSERT OR REPLACE INTO records
        (id, timestamp, type, check_slot, check_label, operator, shift,
         flag, smoke_flag, odour_flag, comp_flag, ev_flag,
         requires_coct, backfill, data_json, photos_json)
      VALUES
        (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id,
      r.timestamp,
      r.type,
      r.checkSlot ?? -1,
      r.checkLabel || '',
      r.operator   || '',
      r.shift      || 'day',
      r.flag       || 'ok',
      r.smokeFlag    ? 1 : 0,
      r.odourFlag    ? 1 : 0,
      r.compFlag     ? 1 : 0,
      r.evFlag       ? 1 : 0,
      r.requiresCoCT ? 1 : 0,
      r.backfill     ? 1 : 0,
      JSON.stringify(r.data   || {}),
      JSON.stringify(r.photos || {})
    );

    res.json({ ok: true, id });
  } catch (err) {
    console.error('POST /records error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/records/batch ──────────────────────────────────────────────────
// Sync a batch of locally-queued records at once
router.post('/batch', (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ ok: false, error: 'records array required' });
    }

    const insert = db.prepare(`
      INSERT OR REPLACE INTO records
        (id, timestamp, type, check_slot, check_label, operator, shift,
         flag, smoke_flag, odour_flag, comp_flag, ev_flag,
         requires_coct, backfill, data_json, photos_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const runBatch = db.transaction((recs) => {
      for (const r of recs) {
        insert.run(
          r.id || uuidv4(),
          r.timestamp,
          r.type,
          r.checkSlot ?? -1,
          r.checkLabel || '',
          r.operator   || '',
          r.shift      || 'day',
          r.flag       || 'ok',
          r.smokeFlag    ? 1 : 0,
          r.odourFlag    ? 1 : 0,
          r.compFlag     ? 1 : 0,
          r.evFlag       ? 1 : 0,
          r.requiresCoCT ? 1 : 0,
          r.backfill     ? 1 : 0,
          JSON.stringify(r.data   || {}),
          JSON.stringify(r.photos || {})
        );
      }
    });

    runBatch(records);
    res.json({ ok: true, synced: records.length });
  } catch (err) {
    console.error('POST /records/batch error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PUT /api/records/:id ─────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const r = req.body;

    const existing = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Record not found' });

    // Merge data_json if provided
    const existingData   = JSON.parse(existing.data_json   || '{}');
    const existingPhotos = JSON.parse(existing.photos_json || '{}');
    const newData   = r.data   ? { ...existingData,   ...r.data   } : existingData;
    const newPhotos = r.photos ? { ...existingPhotos, ...r.photos } : existingPhotos;

    db.prepare(`
      UPDATE records SET
        timestamp     = COALESCE(?, timestamp),
        operator      = COALESCE(?, operator),
        shift         = COALESCE(?, shift),
        flag          = COALESCE(?, flag),
        smoke_flag    = COALESCE(?, smoke_flag),
        odour_flag    = COALESCE(?, odour_flag),
        comp_flag     = COALESCE(?, comp_flag),
        ev_flag       = COALESCE(?, ev_flag),
        requires_coct = COALESCE(?, requires_coct),
        data_json     = ?,
        photos_json   = ?
      WHERE id = ?
    `).run(
      r.timestamp  || null,
      r.operator   || null,
      r.shift      || null,
      r.flag       || null,
      r.smokeFlag    !== undefined ? (r.smokeFlag    ? 1 : 0) : null,
      r.odourFlag    !== undefined ? (r.odourFlag    ? 1 : 0) : null,
      r.compFlag     !== undefined ? (r.compFlag     ? 1 : 0) : null,
      r.evFlag       !== undefined ? (r.evFlag       ? 1 : 0) : null,
      r.requiresCoCT !== undefined ? (r.requiresCoCT ? 1 : 0) : null,
      JSON.stringify(newData),
      JSON.stringify(newPhotos),
      id
    );

    res.json({ ok: true, id });
  } catch (err) {
    console.error('PUT /records/:id error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/records/:id ──────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM records WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/records/export ──────────────────────────────────────────────────
router.get('/export', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM records ORDER BY timestamp DESC').all();
    const headers = ['id','timestamp','type','check_slot','check_label','operator',
                     'shift','flag','smoke_flag','odour_flag','comp_flag','ev_flag',
                     'requires_coct','backfill','created_at'];
    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += headers.map(h => {
        const v = String(r[h] ?? '');
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pyrocheck_export_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
