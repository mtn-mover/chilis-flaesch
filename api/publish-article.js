// API to publish article (commit to GitHub)
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

    // Check permissions
    if (draft.author !== session.username && session.username !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Create file content
    const fileContent = draft.html;
    const fileName = draft.fileName;

    // Step 1: Get the latest commit SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!refResponse.ok) {
      throw new Error('Failed to get branch reference');
    }

    const refData = await refResponse.json();
    const latestCommitSha = refData.object.sha;

    // Step 2: Create a blob with the file content
    const blobResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: Buffer.from(fileContent).toString('base64'),
          encoding: 'base64'
        })
      }
    );

    if (!blobResponse.ok) {
      throw new Error('Failed to create blob');
    }

    const blobData = await blobResponse.json();

    // Step 3: Get the tree of the latest commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${latestCommitSha}`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!commitResponse.ok) {
      throw new Error('Failed to get commit');
    }

    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    // Step 4: Create a new tree with the new file
    const treeResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: [
            {
              path: fileName,
              mode: '100644',
              type: 'blob',
              sha: blobData.sha
            }
          ]
        })
      }
    );

    if (!treeResponse.ok) {
      throw new Error('Failed to create tree');
    }

    const treeData = await treeResponse.json();

    // Step 5: Create a new commit
    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Publish article: ${draft.title}\n\nAutor: ${draft.authorDisplayName}\nKategorie: ${draft.category}`,
          tree: treeData.sha,
          parents: [latestCommitSha]
        })
      }
    );

    if (!newCommitResponse.ok) {
      throw new Error('Failed to create commit');
    }

    const newCommitData = await newCommitResponse.json();

    // Step 6: Update the branch reference
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sha: newCommitData.sha,
          force: false
        })
      }
    );

    if (!updateRefResponse.ok) {
      throw new Error('Failed to update reference');
    }

    // Update draft status to published
    drafts[draftIndex].status = 'published';
    drafts[draftIndex].publishedAt = new Date().toISOString();
    drafts[draftIndex].publishedUrl = `https://www.flaesch.info/${fileName}`;

    await redis.set('drafts', JSON.stringify(drafts));

    return res.status(200).json({
      success: true,
      message: 'Artikel veröffentlicht!',
      url: `https://www.flaesch.info/${fileName}`,
      commitSha: newCommitData.sha
    });

  } catch (error) {
    console.error('Error publishing article:', error);
    return res.status(500).json({
      error: 'Fehler beim Veröffentlichen',
      details: error.message,
      stack: error.stack
    });
  }
};
