// Handler: GET context from Redis
const { verifySession } = require('./auth.js');
const { getContext, migrateFromMarkdown } = require('./context-manager.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionToken } = req.body;
  const session = verifySession(sessionToken);
  if (!session || session.role !== 'admin') {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }

  try {
    let context = await getContext();

    // If no context in Redis, try to migrate from markdown file
    if (!context) {
      console.log('No context in Redis, attempting migration from markdown...');
      try {
        // Try to read the markdown file via GitHub API
        const GITHUB_OWNER = 'mtn-mover';
        const GITHUB_REPO = 'chilis-flaesch';
        const GITHUB_BRANCH = 'master';

        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/context/flaesch-kontext.md?ref=${GITHUB_BRANCH}`,
          {
            headers: {
              'Authorization': `token ${process.env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const markdownContent = Buffer.from(data.content, 'base64').toString('utf-8');
          context = migrateFromMarkdown(markdownContent);

          // Save migrated context to Redis
          const { saveContext } = require('./context-manager.js');
          await saveContext(context);
          console.log('Migration successful, context saved to Redis');
        }
      } catch (migrationError) {
        console.error('Migration failed:', migrationError);
        return res.status(500).json({ error: 'Kein Kontext vorhanden und Migration fehlgeschlagen' });
      }
    }

    return res.status(200).json({ success: true, context });
  } catch (error) {
    console.error('Error getting context:', error);
    return res.status(500).json({ error: 'Fehler beim Laden des Kontexts' });
  }
};
