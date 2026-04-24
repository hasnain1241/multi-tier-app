const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running!' });
});

app.get('/api/data', (req, res) => {
  res.json({ items: ['Item 1', 'Item 2', 'Item 3'] });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
