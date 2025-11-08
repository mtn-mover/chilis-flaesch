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

// Function to wrap article content in full HTML template
function wrapArticleInTemplate(draft) {
  const categoryColors = {
    'politik': '#e74c3c',
    'wirtschaft': '#f39c12',
    'kurioses': '#9b59b6',
    'kultur': '#3498db',
    'sport': '#2ecc71'
  };

  const categoryLabels = {
    'politik': 'Politik',
    'wirtschaft': 'Wirtschaft',
    'kurioses': 'Kurioses',
    'kultur': 'Kultur',
    'sport': 'Sport'
  };

  const categoryColor = categoryColors[draft.category] || '#8B4513';
  const categoryLabel = categoryLabels[draft.category] || draft.category;
  const heroImage = draft.images && draft.images.length > 0 ? draft.images[0] : '';

  return `<!DOCTYPE html>
<html lang="de-CH">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${draft.excerpt || draft.content.substring(0, 150)}">
    <title>${draft.title} | Fläsch Info</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary-color: ${categoryColor};
            --dark-gray: #2D3142;
            --light-gray: #F4F4F4;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: var(--dark-gray);
            line-height: 1.6;
            padding-top: 60px;
        }

        /* Navigation */
        .nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            padding: 1rem 2rem;
        }

        .nav-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .nav-logo {
            display: flex;
            align-items: center;
            text-decoration: none;
        }

        .nav-logo img {
            height: 72px;
            width: auto;
        }

        @media (min-width: 768px) {
            .nav-logo img {
                height: 96px;
            }
        }

        .nav-links {
            display: flex;
            gap: 2rem;
            list-style: none;
        }

        .nav-links a {
            text-decoration: none;
            color: #333;
            font-weight: 500;
            transition: color 0.3s;
        }

        .nav-links a:hover {
            color: var(--primary-color);
        }

        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, var(--primary-color) 0%, #8B4513 100%);
            color: white;
            padding: 3rem 2rem;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        ${heroImage ? `
        .hero-image {
            width: 100%;
            max-width: 1200px;
            height: 400px;
            object-fit: cover;
            margin: 0 auto 2rem;
            border-radius: 10px;
            display: block;
        }
        ` : ''}

        .hero h1 {
            font-size: clamp(2rem, 5vw, 3.5rem);
            font-weight: 700;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .hero-meta {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 2rem;
            flex-wrap: wrap;
            margin-top: 1.5rem;
        }

        .hero-category {
            background: rgba(255,255,255,0.2);
            padding: 0.5rem 1.5rem;
            border-radius: 25px;
            font-weight: 600;
            backdrop-filter: blur(10px);
        }

        .hero-date {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        /* Main Content */
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 3rem 2rem;
        }

        .article-content {
            font-size: 1.1rem;
            line-height: 1.8;
        }

        .article-content p {
            margin-bottom: 1.5rem;
        }

        .article-content h2 {
            font-size: 2rem;
            color: var(--primary-color);
            margin: 2.5rem 0 1.5rem;
        }

        .article-content h3 {
            font-size: 1.5rem;
            color: var(--primary-color);
            margin: 2rem 0 1rem;
        }

        .article-content blockquote {
            border-left: 4px solid var(--primary-color);
            padding-left: 1.5rem;
            margin: 2rem 0;
            font-style: italic;
            color: #666;
        }

        .article-content ul, .article-content ol {
            margin: 1.5rem 0 1.5rem 2rem;
        }

        .article-content li {
            margin-bottom: 0.5rem;
        }

        .article-content img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            margin: 2rem 0;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }

        /* Footer */
        footer {
            background: #2c2c2c;
            color: white;
            padding: 2.5rem 2rem;
            margin-top: 4rem;
        }

        .footer-content {
            max-width: 1200px;
            margin: 0 auto;
            text-align: center;
        }

        .footer-content p {
            margin-bottom: 0.5rem;
            opacity: 0.9;
        }

        .footer-content a {
            color: #FFD700;
            text-decoration: none;
        }

        .footer-content a:hover {
            text-decoration: underline;
        }

        .footer-disclaimer {
            background: rgba(255, 215, 0, 0.15);
            padding: 1rem;
            border-radius: 5px;
            margin-top: 1rem;
            font-style: italic;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .nav-container {
                flex-direction: column;
                gap: 1rem;
            }

            .nav-links {
                flex-wrap: wrap;
                justify-content: center;
                gap: 1rem;
            }

            .hero h1 {
                font-size: 2rem;
            }

            ${heroImage ? `
            .hero-image {
                height: 250px;
            }
            ` : ''}
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="nav">
        <div class="nav-content">
            <a href="index.html" class="nav-logo">
                <img src="logo.png" alt="Fläsch Info Logo">
            </a>
            <ul class="nav-links">
                <li><a href="index.html">Startseite</a></li>
                <li><a href="ueber-uns.html">Über uns</a></li>
                <li><a href="index.html#alle">Alle Geschichten</a></li>
            </ul>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
        ${heroImage ? `<img src="${heroImage}" alt="${draft.title}" class="hero-image">` : ''}
        <h1>${draft.title}</h1>
        <div class="hero-meta">
            <span class="hero-category">${categoryLabel}</span>
            <span class="hero-date">${new Date().toLocaleDateString('de-CH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
    </section>

    <!-- Main Content -->
    <div class="container">
        <article class="article-content">
            ${draft.html || draft.content}
        </article>
    </div>

    <!-- Footer -->
    <footer>
        <div class="footer-content">
            <p>🍷 <strong>Fläsch Info</strong> - Satirische Geschichten aus Fläsch</p>
            <p>&copy; ${new Date().getFullYear()} Fläsch mittendrin - oder doch daneben?</p>
            <div class="footer-disclaimer">
                ⚠️ Diese Webseite ist SATIRE! Alle Geschichten sind frei erfunden und dienen ausschliesslich der Unterhaltung.
                <br><br>
                🤖 Diese Webseite wurde mit KI erstellt. Inhalte werden von künstlicher Intelligenz generiert.
                <br>
                💬 Kontakt: <a href="https://claude.ai/new" target="_blank">Mit Claude chatten</a> |
                <a href="mailto:fluesterer@flaesch.info">fluesterer@flaesch.info</a>
            </div>
            <p style="margin-top: 1.5rem;">
                <a href="index.html">← Zurück zur Startseite</a>
            </p>
        </div>
    </footer>
</body>
</html>`;
}

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

    // Create file content - wrap in full HTML template
    const fileContent = wrapArticleInTemplate(draft);
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

    // Step 7: Update articles.json to add new article to homepage
    // Get current articles.json
    const articlesJsonResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/articles.json?ref=${GITHUB_BRANCH}`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let articles = [];
    let articlesJsonSha = null;

    if (articlesJsonResponse.ok) {
      const articlesJsonData = await articlesJsonResponse.json();
      articlesJsonSha = articlesJsonData.sha;
      const articlesContent = Buffer.from(articlesJsonData.content, 'base64').toString('utf-8');
      articles = JSON.parse(articlesContent);
    }

    // Add new article at the beginning
    articles.unshift({
      title: draft.title,
      fileName: fileName,
      category: draft.category,
      excerpt: draft.content.substring(0, 100) + '...',
      date: new Date().toISOString().split('T')[0],
      image: draft.images && draft.images.length > 0 ? draft.images[0] : null
    });

    // Update articles.json via GitHub API
    const updateArticlesResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/articles.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Update articles.json: add ${draft.title}`,
          content: Buffer.from(JSON.stringify(articles, null, 2)).toString('base64'),
          sha: articlesJsonSha,
          branch: GITHUB_BRANCH
        })
      }
    );

    if (!updateArticlesResponse.ok) {
      console.error('Failed to update articles.json, but article was published');
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
