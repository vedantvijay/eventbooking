const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const auth = require('../middleware/auth');

const router = express.Router();

// Create a new event
router.post('/',
  auth,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('date').isISO8601().toDate().withMessage('Valid date is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, description, date, capacity } = req.body;
      const event = new Event({
        title,
        description,
        date,
        capacity,
        availableSeats: capacity,
        creator: req.user.id,
      });

      await event.save();
      res.status(201).json(event);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get a specific event
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).send('Server error');
  }
});

// Update an event
router.put('/:id',
  auth,
  [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty'),
    body('date').optional().isISO8601().toDate().withMessage('Valid date is required'),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      let event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      if (event.creator.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to update this event' });
      }

      const { title, description, date, capacity } = req.body;
      if (title) event.title = title;
      if (description) event.description = description;
      if (date) event.date = date;
      if (capacity) {
        const seatsDifference = capacity - event.capacity;
        event.capacity = capacity;
        event.availableSeats += seatsDifference;
      }

      await event.save();
      res.json(event);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Event not found' });
      }
      res.status(500).send('Server error');
    }
  }
);

// Delete an event
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.creator.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this event' });
    }

    await event.remove();
    res.json({ message: 'Event removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).send('Server error');
  }
});

module.exports = router;