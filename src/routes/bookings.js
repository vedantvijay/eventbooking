const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const auth = require('../middleware/auth');

const router = express.Router();

// Create a new booking
router.post('/',
  auth,
  [
    body('eventId').notEmpty().withMessage('Event ID is required'),
    body('seats').isInt({ min: 1 }).withMessage('Number of seats must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { eventId, seats } = req.body;
      const event = await Event.findById(eventId);

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      if (event.availableSeats < seats) {
        return res.status(400).json({ message: 'Not enough available seats' });
      }

      const booking = new Booking({
        event: eventId,
        user: req.user.id,
        seats,
      });

      event.availableSeats -= seats;
      await event.save();
      await booking.save();

      res.status(201).json(booking);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// Get all bookings for the current user
router.get('/', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).populate('event', 'title date');
    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Cancel a booking
router.delete('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to cancel this booking' });
    }

    const event = await Event.findById(booking.event);
    if (event) {
      event.availableSeats += booking.seats;
      await event.save();
    }

    await booking.remove();
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.status(500).send('Server error');
  }
});

module.exports = router;