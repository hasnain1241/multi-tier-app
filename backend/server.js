const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let listings = [
  { id: 1, title: 'Vintage Camera', price: 85, category: 'Electronics', seller: 'Ahmed K.', description: 'Canon AE-1, fully working, great condition.', posted: '2026-04-20' },
  { id: 2, title: 'Mountain Bike', price: 220, category: 'Sports', seller: 'Sara M.', description: '21-speed, barely used, comes with helmet.', posted: '2026-04-21' },
  { id: 3, title: 'Calculus Textbook', price: 15, category: 'Books', seller: 'Ali R.', description: '8th edition, minor highlights, great shape.', posted: '2026-04-22' },
  { id: 4, title: 'Standing Desk', price: 150, category: 'Furniture', seller: 'Zara T.', description: 'Height-adjustable, 120cm wide, light oak finish.', posted: '2026-04-23' },
];
let nextId = 5;

const categories = ['Electronics', 'Sports', 'Books', 'Furniture', 'Clothing', 'Other'];

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Market Community Place API running!' });
});

app.get('/api/listings', (req, res) => {
  const { category } = req.query;
  if (category && category !== 'All') {
    return res.json(listings.filter(l => l.category === category));
  }
  res.json(listings);
});

app.post('/api/listings', (req, res) => {
  const { title, price, category, seller, description } = req.body;
  if (!title || !price || !category || !seller) {
    return res.status(400).json({ error: 'title, price, category and seller are required' });
  }
  const listing = {
    id: nextId++,
    title,
    price: Number(price),
    category,
    seller,
    description: description || '',
    posted: new Date().toISOString().split('T')[0],
  };
  listings.push(listing);
  res.status(201).json(listing);
});

app.get('/api/categories', (req, res) => {
  res.json(categories);
});

app.listen(PORT, () => {
  console.log(`Market API running on port ${PORT}`);
});
