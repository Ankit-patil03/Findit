// Saves a notification for a user. `db` can be the pool or a transaction client.
// Right now notifications are stored in the database and the frontend reads them.
// At deployment time, add the AWS SNS publish call inside this one function.
async function createNotification(db, userId, message, matchId = null) {
  const result = await db.query(
    `INSERT INTO notifications (user_id, message, match_id)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, message, match_id, is_read, created_at`,
    [userId, message, matchId]
  );
  // TODO (AWS deployment): publish this message to SNS here
  return result.rows[0];
}

// Sends the same notification to every admin (e.g. "new match needs review").
// Goes through createNotification, so SNS will cover these too once it's added there.
async function notifyAdmins(db, message, matchId = null) {
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin'");
  for (const admin of admins.rows) {
    await createNotification(db, admin.id, message, matchId);
  }
}

module.exports = { createNotification, notifyAdmins };