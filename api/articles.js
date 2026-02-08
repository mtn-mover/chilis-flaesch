// Router: articles (create, publish, delete)
const createHandler = require('./_lib/create-article');
const publishHandler = require('./_lib/publish-article');
const deleteHandler = require('./_lib/delete-article');

module.exports = async function handler(req, res) {
  const action = req.query.action;
  switch (action) {
    case 'create': return createHandler(req, res);
    case 'publish': return publishHandler(req, res);
    case 'delete': return deleteHandler(req, res);
    default: return res.status(400).json({ error: 'Unknown action' });
  }
};
