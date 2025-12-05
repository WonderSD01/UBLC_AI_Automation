const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');

router.get('/', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) {
      const all = await dataService.readBooks();
      return res.json(all);
    }
    const results = await dataService.findBooksByQuery(q);
    res.json(results);
  } catch (err) {
    console.error('GET /api/books error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;