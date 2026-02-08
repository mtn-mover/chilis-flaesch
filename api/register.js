// Router: register (register, activate-account)
const registerHandler = require('./_lib/register');
const activateHandler = require('./_lib/activate-account');

module.exports = async function handler(req, res) {
  const action = req.query.action;
  switch (action) {
    case 'activate': return activateHandler(req, res);
    default: return registerHandler(req, res);
  }
};
