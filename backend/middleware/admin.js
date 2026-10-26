// Use AFTER the auth middleware: router.use(auth, requireAdmin)
// auth puts the decoded token on req.user, which includes the role.
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = requireAdmin;