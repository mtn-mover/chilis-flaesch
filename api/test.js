// Simple test endpoint
module.exports = async function handler(req, res) {
  try {
    // Test 1: Basic response
    const test1 = "Basic response works";

    // Test 2: Environment variable
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    const apiKeyPreview = process.env.ANTHROPIC_API_KEY ?
      process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'NOT SET';

    // Test 3: Try to load Anthropic
    let anthropicTest = "NOT TESTED";
    try {
      const { Anthropic } = require('@anthropic-ai/sdk');
      anthropicTest = "Loaded successfully";

      // Test 4: Try to instantiate
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || 'test'
      });
      anthropicTest = "Instantiated successfully";
    } catch (e) {
      anthropicTest = "ERROR: " + e.message;
    }

    // Test 5: JWT
    let jwtTest = "NOT TESTED";
    try {
      const jwt = require('jsonwebtoken');
      jwtTest = "JWT loaded successfully";
    } catch (e) {
      jwtTest = "ERROR: " + e.message;
    }

    return res.status(200).json({
      success: true,
      tests: {
        basicResponse: test1,
        apiKey: {
          isSet: hasApiKey,
          preview: apiKeyPreview
        },
        anthropic: anthropicTest,
        jwt: jwtTest,
        nodeVersion: process.version
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
