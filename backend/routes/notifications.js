const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications  - the logged-in user's notifications, newest first
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, message, match_id, is_read, created_at
         FROM notifications WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Could not fetch notifications' });
  }
});

// GET /api/notifications/unread-count  - for the bell badge in the navbar
router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Could not fetch unread count' });
  }
});

// PATCH /api/notifications/read-all
// (defined before "/:id/read" so "read-all" is never mistaken for an id)
router.patch('/read-all', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ updated: result.rowCount });
  } catch (err) {
    console.error('Read all error:', err);
    res.status(500).json({ error: 'Could not update notifications' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', auth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    // user_id in the WHERE clause means you can only mark YOUR OWN notifications
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2
       RETURNING id, message, match_id, is_read, created_at`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Could not update the notification' });
  }
});

module.exports = router;