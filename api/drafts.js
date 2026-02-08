// Router: drafts (save, get, delete)
const saveHandler = require('./_lib/save-draft');
const getHandler = require('./_lib/get-drafts');
const deleteHandler = require('./_lib/delete-draft');

module.exports = async function handler(req, res) {
  const action = req.query.action;
  switch (action) {
    case 'save': return saveHandler(req, res);
    case 'get': return getHandler(req, res);
    case 'delete': return deleteHandler(req, res);
    default: return res.status(400).json({ error: 'Unknown action' });
  }
};
