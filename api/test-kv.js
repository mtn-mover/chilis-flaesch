// Test KV connection
const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  try {
    // Test 1: Check environment variables
    const envVars = {
      KV_REST_API_URL: process.env.KV_REST_API_URL ? 'SET' : 'NOT SET',
      KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'SET' : 'NOT SET',
      KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN ? 'SET' : 'NOT SET',
      KV_URL: process.env.KV_URL ? 'SET' : 'NOT SET',
      REDIS_URL: process.env.REDIS_URL ? 'SET' : 'NOT SET'
    };

    // Test 2: Try to write to KV
    let writeTest = 'NOT TESTED';
    try {
      await kv.set('test-key', { message: 'Hello from KV', timestamp: Date.now() });
      writeTest = 'SUCCESS';
    } catch (e) {
      writeTest = 'FAILED: ' + e.message;
    }

    // Test 3: Try to read from KV
    let readTest = 'NOT TESTED';
    try {
      const value = await kv.get('test-key');
      readTest = value ? 'SUCCESS: ' + JSON.stringify(value) : 'NO DATA';
    } catch (e) {
      readTest = 'FAILED: ' + e.message;
    }

    // Test 4: Try to read drafts
    let draftsTest = 'NOT TESTED';
    try {
      const drafts = await kv.get('drafts');
      draftsTest = drafts ? 'EXISTS (' + drafts.length + ' drafts)' : 'EMPTY (null)';
    } catch (e) {
      draftsTest = 'FAILED: ' + e.message;
    }

    return res.status(200).json({
      success: true,
      tests: {
        environmentVariables: envVars,
        kvWrite: writeTest,
        kvRead: readTest,
        draftsKey: draftsTest
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
