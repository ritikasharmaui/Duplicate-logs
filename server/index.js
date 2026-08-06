const express = require('express');
const cors = require('cors');

const settingsRoutes = require('./routes/settings');
const recordsRoutes = require('./routes/records');
const downloadsRoutes = require('./routes/downloads');
const leadsRoutes = require('./routes/leads');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/settings', settingsRoutes);
app.use('/api/duplicate-records', recordsRoutes);
app.use('/api/download-requests', downloadsRoutes);
app.use('/api/leads', leadsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Duplicate Logs API listening on http://localhost:${PORT}`);
});
