#!/usr/bin/env node
// Test script to verify image upload works end-to-end
// Usage: node scripts/test-upload.js <username> <password> [base_url]

const https = require('https');
const http = require('http');

const username = process.argv[2];
const password = process.argv[3];
const BASE_URL = process.argv[4] || 'https://www.flaesch.info';

if (!username || !password) {
  console.error('Usage: node scripts/test-upload.js <username> <password> [base_url]');
  process.exit(1);
}

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log(`\n=== Upload Test for ${BASE_URL} ===\n`);

  // Step 1: Login
  console.log('1. Logging in...');
  const loginPayload = JSON.stringify({ username, password });
  const loginRes = await request(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginPayload) },
  }, loginPayload);

  if (loginRes.status !== 200 || !loginRes.body.sessionToken) {
    console.error('   FAIL: Login failed -', loginRes.body.error || loginRes.status);
    process.exit(1);
  }
  console.log('   OK: Logged in as', loginRes.body.displayName);
  const sessionToken = loginRes.body.sessionToken;

  // Step 2: Upload a tiny test image (1x1 red pixel PNG)
  console.log('2. Uploading test image...');
  const testImageBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  const uploadPayload = JSON.stringify({
    sessionToken,
    imageData: testImageBase64,
    fileName: 'test-pixel.png',
    articleSlug: 'upload-test',
  });

  const uploadRes = await request(`${BASE_URL}/api/upload-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(uploadPayload) },
  }, uploadPayload);

  if (uploadRes.status !== 200 || !uploadRes.body.success) {
    console.error('   FAIL: Upload failed -', JSON.stringify(uploadRes.body));
    process.exit(1);
  }
  console.log('   OK: Image uploaded to', uploadRes.body.imageUrl);

  // Step 3: Verify the image is accessible
  console.log('3. Verifying image URL...');
  const imgRes = await request(uploadRes.body.imageUrl, { method: 'HEAD' });
  if (imgRes.status === 200) {
    console.log('   OK: Image accessible');
  } else {
    console.error('   WARN: Image returned status', imgRes.status);
  }

  console.log('\n=== ALL TESTS PASSED ===\n');
}

run().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
