// API to upload images for articles
const { verifySession } = require('./auth.js');
const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionToken, imageData, fileName, articleSlug } = req.body;

    // Verify session
    const session = verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    if (!imageData || !fileName) {
      return res.status(400).json({ error: 'Bild-Daten oder Dateiname fehlt' });
    }

    // Validate file extension
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedExts.includes(fileExt)) {
      return res.status(400).json({
        error: 'Ungültiges Bildformat. Erlaubt: JPG, PNG, GIF, WebP'
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = fileName
      .replace(/[^a-z0-9.-]/gi, '-')
      .toLowerCase();
    const uniqueFileName = `${articleSlug || 'upload'}-${timestamp}-${sanitizedName}`;

    // Decode base64 image data
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      return res.status(400).json({
        error: 'Bild zu gross. Maximum: 5MB'
      });
    }

    // Upload to Vercel Blob
    const blob = await put(uniqueFileName, buffer, {
      access: 'public',
      addRandomSuffix: false
    });

    return res.status(200).json({
      success: true,
      imageUrl: blob.url,
      fileName: uniqueFileName,
      message: 'Bild hochgeladen'
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    return res.status(500).json({
      error: 'Fehler beim Hochladen des Bildes',
      details: error.message
    });
  }
};
