// Router: password (forgot-password, forgot-username, reset-password)
const forgotPasswordHandler = require('./_lib/forgot-password');
const forgotUsernameHandler = require('./_lib/forgot-username');
const resetPasswordHandler = require('./_lib/reset-password');

module.exports = async function handler(req, res) {
  const action = req.query.action;
  switch (action) {
    case 'forgot-password': return forgotPasswordHandler(req, res);
    case 'forgot-username': return forgotUsernameHandler(req, res);
    case 'reset': return resetPasswordHandler(req, res);
    default: return res.status(400).json({ error: 'Unknown action' });
  }
};
