// Handler: Export context from Redis to Git (backup as markdown)
const { verifySession } = require('./auth.js');
const { getContext, renderContextForLLM } = require('./context-manager.js');

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
    const context = await getContext();
    if (!context) {
      return res.status(404).json({ error: 'Kein Kontext vorhanden' });
    }

    // Render full context as markdown
    const rendered = await renderContextForLLM({ maxEvents: 999, minImportance: 'low' });
    const markdown = `# Fläsch Info - Kontext für Artikel-Generierung\n\n_Exportiert am ${new Date().toLocaleDateString('de-CH')}_\n\n${rendered}`;

    // Commit to GitHub
    const GITHUB_OWNER = 'mtn-mover';
    const GITHUB_REPO = 'chilis-flaesch';
    const GITHUB_BRANCH = 'main';
    const filePath = 'context/flaesch-kontext.md';

    // Get current file SHA (needed for update)
    const getResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let sha = null;
    if (getResponse.ok) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
    }

    // Create or update file
    const updateBody = {
      message: 'chore: export context from Redis backup',
      content: Buffer.from(markdown).toString('base64'),
      branch: GITHUB_BRANCH
    };
    if (sha) {
      updateBody.sha = sha;
    }

    const updateResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateBody)
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`GitHub API error: ${errorData.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Kontext erfolgreich nach Git exportiert'
    });
  } catch (error) {
    console.error('Error exporting context:', error);
    return res.status(500).json({ error: 'Fehler beim Export: ' + error.message });
  }
};
