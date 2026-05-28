require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',   // Allow any origin (Netlify URL, direct IP, etc)
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}));

app.use(express.json({ limit: '10mb' }));  // 10MB for photo data
app.use(express.urlencoded({ extended: true }));

// ── API Key Auth ──────────────────────────────────────────────────────────────
const API_KEY = process.env.API_KEY;

app.use('/api', (req, res, next) => {
  if (!API_KEY) return next(); // No key configured = open (dev mode)
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized — invalid API key' });
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/records',  require('./routes/records'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));

// Health check (no auth needed)
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'GeT Energy PyroCheck API',
    time: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve the frontend HTML if it exists in /public
const PUBLIC = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC)) {
  app.use(express.static(PUBLIC));
  app.get('*', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏭 GeT Energy PyroCheck API running on port ${PORT}`);
  console.log(`🔑 API Key auth: ${API_KEY ? 'ENABLED' : 'DISABLED (set API_KEY env var)'}`);
  console.log(`📁 Database: ${process.env.DATA_DIR || './data'}/pyrocheck.db\n`);
});
