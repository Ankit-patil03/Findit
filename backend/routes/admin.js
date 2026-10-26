const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const { MATCH_STATUS } = require('../services/matching');
const { createNotification } = require('../services/notify');

const router = express.Router();

// Every route in this file requires a valid login AND the admin role
router.use(auth, requireAdmin);

const isId = (s) => /^\d+$/.test(s);

// ---------- GET /api/admin/matches?status=pending ----------
// status can be pending (default), confirmed, rejected, or all.
// Highest match score first, so the admin reviews the strongest candidates first.
router.get('/matches', async (req, res) => {
  const status = req.query.status || MATCH_STATUS.PENDING;
  try {
    const params = [];
    let where = '';
    if (status !== 'all') {
      params.push(status);
      where = 'WHERE m.status = $1';
    }
    const result = await pool.query(
      `SELECT m.id, m.match_score, m.status, m.verified_by, m.created_at,
              vu.name AS verified_by_name,
              l.id AS lost_id, l.item_name AS lost_name, l.category AS lost_category,
              l.location AS lost_location, to_char(l.item_date, 'YYYY-MM-DD') AS lost_date,
              l.description AS lost_description, l.image_url AS lost_image,
              l.proof_details AS lost_proof, l.status AS lost_status,
              lu.id AS lost_user_id, lu.name AS lost_user_name, lu.email AS lost_user_email,
              f.id AS found_id, f.item_name AS found_name, f.category AS found_category,
              f.location AS found_location, to_char(f.item_date, 'YYYY-MM-DD') AS found_date,
              f.description AS found_description, f.image_url AS found_image,
              f.proof_details AS found_proof, f.status AS found_status,
              fu.id AS found_user_id, fu.name AS found_user_name, fu.email AS found_user_email
         FROM matches m
         JOIN items l  ON l.id  = m.lost_item_id
         JOIN items f  ON f.id  = m.found_item_id
         JOIN users lu ON lu.id = l.user_id
         JOIN users fu ON fu.id = f.user_id
         LEFT JOIN users vu ON vu.id = m.verified_by -- the admin who approved/rejected (empty if auto-rejected)
         ${where}
        ORDER BY m.match_score DESC, m.created_at DESC`,
      params
    );

    // Shape each row as { match info, lost_item: {...}, found_item: {...} } so the frontend can show two cards side by side
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        match_score: r.match_score,
        status: r.status,
        verified_by: r.verified_by,
        verified_by_name: r.verified_by_name,
        created_at: r.created_at,
        // proof = the reporter's private ownership details, shown only to admins
        lost_item: {
          id: r.lost_id, name: r.lost_name, category: r.lost_category, location: r.lost_location,
          date: r.lost_date, description: r.lost_description, image_url: r.lost_image,
          proof: r.lost_proof, status: r.lost_status,
          reporter: { id: r.lost_user_id, name: r.lost_user_name, email: r.lost_user_email },
        },
        found_item: {
          id: r.found_id, name: r.found_name, category: r.found_category, location: r.found_location,
          date: r.found_date, description: r.found_description, image_url: r.found_image,
          proof: r.found_proof, status: r.found_status,
          reporter: { id: r.found_user_id, name: r.found_user_name, email: r.found_user_email },
        },
      }))
    );
  } catch (err) {
    console.error('Admin list matches error:', err);
    res.status(500).json({ error: 'Could not fetch matches' });
  }
});

// ---------- PATCH /api/admin/matches/:id/approve ----------
// All the steps below succeed together or none of them happen (a database transaction).
router.patch('/matches/:id/approve', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid match id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Confirm the match. "AND status = pending" stops approving the same match twice.
    const matchResult = await client.query(
      `UPDATE matches SET status = $1, verified_by = $2
        WHERE id = $3 AND status = $4 RETURNING *`,
      [MATCH_STATUS.CONFIRMED, req.user.id, req.params.id, MATCH_STATUS.PENDING]
    );
    if (!matchResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending match not found' });
    }
    const match = matchResult.rows[0];

    // 2. Mark both reports as matched
    const itemsResult = await client.query(
      `UPDATE items SET status = 'matched' WHERE id IN ($1, $2)
       RETURNING id, user_id, type, item_name`,
      [match.lost_item_id, match.found_item_id]
    );

    // 3. Reject other pending matches for these two items (an item can only go to one person).
    //    verified_by stays empty on these, since no admin reviewed them one by one.
    await client.query(
      `UPDATE matches SET status = $1
        WHERE status = $2 AND id <> $3
          AND (lost_item_id IN ($4, $5) OR found_item_id IN ($4, $5))`,
      [MATCH_STATUS.REJECTED, MATCH_STATUS.PENDING, match.id, match.lost_item_id, match.found_item_id]
    );

    // 4. Notify both users
    for (const item of itemsResult.rows) {
      const message =
        item.type === 'lost'
          ? `Good news! A match for your lost item "${item.item_name}" has been verified. Please contact the admin to arrange the handover.`
          : `The item you found ("${item.item_name}") has been matched with its owner. Please contact the admin to arrange the handover.`;
      await createNotification(client, item.user_id, message, match.id);
    }

    await client.query('COMMIT');
    res.json({ message: 'Match approved', match });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve match error:', err);
    res.status(500).json({ error: 'Could not approve the match' });
  } finally {
    client.release();
  }
});

// ---------- PATCH /api/admin/matches/:id/reject ----------
router.patch('/matches/:id/reject', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid match id' });
  try {
    const result = await pool.query(
      `UPDATE matches SET status = $1, verified_by = $2
        WHERE id = $3 AND status = $4 RETURNING *`,
      [MATCH_STATUS.REJECTED, req.user.id, req.params.id, MATCH_STATUS.PENDING]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Pending match not found' });
    res.json({ message: 'Match rejected', match: result.rows[0] });
  } catch (err) {
    console.error('Reject match error:', err);
    res.status(500).json({ error: 'Could not reject the match' });
  }
});

// ---------- PATCH /api/admin/matches/:id/resolve ----------
// Use after the item has physically been handed back: marks both reports as resolved.
router.patch('/matches/:id/resolve', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid match id' });
  try {
    const matchResult = await pool.query(
      'SELECT lost_item_id, found_item_id FROM matches WHERE id = $1 AND status = $2',
      [req.params.id, MATCH_STATUS.CONFIRMED]
    );
    if (!matchResult.rows.length) return res.status(404).json({ error: 'Confirmed match not found' });

    const { lost_item_id, found_item_id } = matchResult.rows[0];
    await pool.query(`UPDATE items SET status = 'resolved' WHERE id IN ($1, $2)`, [
      lost_item_id,
      found_item_id,
    ]);
    res.json({ message: 'Both reports marked as resolved' });
  } catch (err) {
    console.error('Resolve match error:', err);
    res.status(500).json({ error: 'Could not resolve the match' });
  }
});

// ---------- GET /api/admin/items?status=&type= ----------
// System-wide report history, including who reported each item.
router.get('/items', async (req, res) => {
  const { status, type } = req.query;
  const conditions = [];
  const values = [];
  if (status) { values.push(status); conditions.push(`i.status = $${values.length}`); }
  if (['lost', 'found'].includes(type)) { values.push(type); conditions.push(`i.type = $${values.length}`); }

  try {
    const result = await pool.query(
      `SELECT i.id, i.user_id, u.name AS reporter_name, u.email AS reporter_email,
              i.type, i.item_name AS name, i.category, i.location,
              to_char(i.item_date, 'YYYY-MM-DD') AS date_occurred,
              i.description, i.image_url, i.proof_details, i.status, i.created_at
         FROM items i JOIN users u ON u.id = i.user_id
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        ORDER BY i.created_at DESC LIMIT 200`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Admin list items error:', err);
    res.status(500).json({ error: 'Could not fetch items' });
  }
});

// ---------- GET /api/admin/users ----------
// Lists specific columns only. Never include the password column.
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Could not fetch users' });
  }
});

module.exports = router;