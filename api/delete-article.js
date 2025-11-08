// API to delete published article from GitHub
const { verifySession } = require('./auth.js');
const Redis = require('ioredis');

// Initialize Redis client
let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  const { kv } = require('@vercel/kv');
  redis = kv;
}

// GitHub API configuration
const GITHUB_OWNER = 'mtn-mover';
const GITHUB_REPO = 'chilis-flaesch';
const GITHUB_BRANCH = 'master';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionToken, draftId } = req.body;

    // Verify session
    const session = verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    if (!draftId) {
      return res.status(400).json({ error: 'Draft ID fehlt' });
    }

    // Check GitHub token
    if (!process.env.GITHUB_TOKEN) {
      return res.status(500).json({ error: 'GitHub Token nicht konfiguriert' });
    }

    // Get draft from Redis
    const draftsJson = await redis.get('drafts');
    const drafts = draftsJson ? JSON.parse(draftsJson) : [];

    const draftIndex = drafts.findIndex(d => d.id === draftId);
    if (draftIndex < 0) {
      return res.status(404).json({ error: 'Draft nicht gefunden' });
    }

    const draft = drafts[draftIndex];

    // Check permissions - only admin or author can delete
    if (draft.author !== session.username && session.username !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung zum Löschen' });
    }

    // Check if article is published
    if (draft.status !== 'published') {
      return res.status(400).json({ error: 'Artikel ist nicht veröffentlicht' });
    }

    const fileName = draft.fileName;

    // Step 1: Get file SHA from GitHub
    const fileResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${fileName}?ref=${GITHUB_BRANCH}`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!fileResponse.ok) {
      return res.status(404).json({ error: 'Artikel-Datei nicht auf GitHub gefunden' });
    }

    const fileData = await fileResponse.json();
    const fileSha = fileData.sha;

    // Step 2: Delete the file from GitHub
    const deleteResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${fileName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Delete article: ${draft.title}`,
          sha: fileSha,
          branch: GITHUB_BRANCH
        })
      }
    );

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      throw new Error(`Failed to delete file: ${errorData.message}`);
    }

    // Step 3: Update articles.json to remove article from homepage
    const articlesJsonResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/articles.json?ref=${GITHUB_BRANCH}`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (articlesJsonResponse.ok) {
      const articlesJsonData = await articlesJsonResponse.json();
      const articlesJsonSha = articlesJsonData.sha;
      const articlesContent = Buffer.from(articlesJsonData.content, 'base64').toString('utf-8');
      let articles = JSON.parse(articlesContent);

      // Remove the article from the list
      articles = articles.filter(a => a.fileName !== fileName);

      // Update articles.json
      await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/articles.json`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Update articles.json: remove ${draft.title}`,
            content: Buffer.from(JSON.stringify(articles, null, 2)).toString('base64'),
            sha: articlesJsonSha,
            branch: GITHUB_BRANCH
          })
        }
      );
    }

    // Step 4: Update draft status back to 'draft'
    drafts[draftIndex].status = 'draft';
    delete drafts[draftIndex].publishedAt;
    delete drafts[draftIndex].publishedUrl;

    await redis.set('drafts', JSON.stringify(drafts));

    return res.status(200).json({
      success: true,
      message: 'Artikel wurde gelöscht und zurück zu Draft gesetzt'
    });

  } catch (error) {
    console.error('Error deleting article:', error);
    return res.status(500).json({
      error: 'Fehler beim Löschen',
      details: error.message
    });
  }
};
