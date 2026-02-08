// Router: auth (login, logout, verify)
const loginHandler = require('./_lib/auth');
const logoutHandler = require('./_lib/logout');
const verifyHandler = require('./_lib/verify');

// Re-export verifySession for backward compatibility
module.exports = async function handler(req, res) {
  const action = req.query.action;
  switch (action) {
    case 'logout': return logoutHandler(req, res);
    case 'verify': return verifyHandler(req, res);
    default: return loginHandler(req, res);
  }
};

module.exports.verifySession = loginHandler.verifySession;
