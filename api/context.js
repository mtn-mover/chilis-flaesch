// Router for context management (serverless function #12)
const contextGetHandler = require('./_lib/context-get');
const contextUpdateHandler = require('./_lib/context-update');
const contextCompressHandler = require('./_lib/context-compress');
const contextExportHandler = require('./_lib/context-export');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action;
  switch (action) {
    case 'get': return contextGetHandler(req, res);
    case 'update': return contextUpdateHandler(req, res);
    case 'compress': return contextCompressHandler(req, res);
    case 'export': return contextExportHandler(req, res);
    default: return res.status(400).json({ error: 'Unknown action' });
  }
};
