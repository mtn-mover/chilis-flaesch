// Router: comments (list/post, generate, moderate, admin-rejected)
const commentsHandler = require('./_lib/comments');
const generateHandler = require('./_lib/generate-comment');
const adminRejectedHandler = require('./_lib/admin-rejected-comments');

module.exports = async function handler(req, res) {
  const action = req.query.action;
  switch (action) {
    case 'generate': return generateHandler(req, res);
    case 'admin-rejected': return adminRejectedHandler(req, res);
    default: return commentsHandler(req, res);
  }
};
