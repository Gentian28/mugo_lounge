const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// Basic Auth credentials — override with env vars if needed
const ADMIN_USER = process.env.MUGO_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.MUGO_ADMIN_PASS || 'mugo1234kf';
const EXPECTED_AUTH = 'Basic ' + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (auth === EXPECTED_AUTH) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="MUGO Admin"');
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/save-menu', authMiddleware, (req, res) => {
  const menu = req.body;
  if (!menu || typeof menu !== 'object') return res.status(400).json({ error: 'Invalid payload' });

  const target = path.join(__dirname, 'menu.json');
  const backup = target + '.bak';

  try {
    if (fs.existsSync(target)) {
      fs.copyFileSync(target, backup);
    }
    fs.writeFileSync(target, JSON.stringify(menu, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to write menu.json', err);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

app.listen(PORT, () => {
  console.log(`MUGO server running at http://localhost:${PORT}`);
});
// (file ends here)
