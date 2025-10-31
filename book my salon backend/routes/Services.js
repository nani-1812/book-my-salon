const express = require('express');
const router = express.Router();
const Service = require('../models/Service'); // Matches Service.js in models

// GET /services - Fetch all services
router.get('/services', async (req, res) => {
  try {
    const services = await Service.find({});
    res.status(200).json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
