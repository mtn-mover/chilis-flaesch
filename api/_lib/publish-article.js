// API to publish article (commit to GitHub)
const { verifySession } = require('./auth.js');
const Redis = require('ioredis');
const { Anthropic } = require('@anthropic-ai/sdk');
const { addEventFromArticle } = require('./context-manager.js');

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
    'gesellschaft': '#3498db',
    'kirche': '#27ae60',
    'kultur': '#3498db',
    'sport': '#2ecc71'
  };

  const categoryLabels = {
    'politik': 'Politik',
    'wirtschaft': 'Wirtschaft',
    'kurioses': 'Kurioses',
    'gesellschaft': 'Gesellschaft',
    'kirche': 'Kirche',
    'kultur': 'Kultur',
    'sport': 'Sport'
  };

  const categoryColor = categoryColors[draft.category] || '#8B4513';
  const categoryLabel = categoryLabels[draft.category] || draft.category;

  // Handle images: first as hero, rest embedded in article
  const images = draft.images || [];
  const heroImage = images.length > 0 ? images[0] : '';
  const additionalImages = images.length > 1 ? images.slice(1) : [];

  // Generate HTML for additional images to embed in article
  const additionalImagesHTML = additionalImages.map(img =>
    `<img src="${img}" alt="Artikel Bild">`
  ).join('\n');

  // Get article content and inject additional images after first paragraph
  let articleContent = draft.html || draft.content;

  // Clean up inline styles from rich text editor to ensure consistent formatting
  // Remove style attributes from all tags except img (which may need specific styling)
  articleContent = articleContent
    .replace(/<(\w+)([^>]*)\s+style="[^"]*"([^>]*)>/gi, (match, tag, before, after) => {
      // Keep style on img tags for proper image display
      if (tag.toLowerCase() === 'img') return match;
      return `<${tag}${before}${after}>`;
    })
    // Remove empty class attributes
    .replace(/\s+class=""/g, '')
    // Fix nested h2 with p tags (common editor issue)
    .replace(/<h2>\s*<p[^>]*>(.*?)<\/p>\s*<\/h2>/gi, '<h2>$1</h2>')
    .replace(/<h3>\s*<p[^>]*>(.*?)<\/p>\s*<\/h3>/gi, '<h3>$1</h3>')
    // Remove color styles that might have been added
    .replace(/\s*color:\s*rgb\([^)]+\);?/gi, '')
    .replace(/\s*color:\s*#[0-9a-f]+;?/gi, '')
    // Clean up font-size inline styles
    .replace(/\s*font-size:\s*[^;]+;?/gi, '')
    // Clean up font-weight inline styles (except in specific cases)
    .replace(/\s*font-weight:\s*\d+;?/gi, '');
  if (additionalImagesHTML && articleContent) {
    // Find first closing </p> tag and insert images after it
    const firstParagraphEnd = articleContent.indexOf('</p>');
    if (firstParagraphEnd !== -1) {
      articleContent = articleContent.slice(0, firstParagraphEnd + 4) +
                     '\n' + additionalImagesHTML + '\n' +
                     articleContent.slice(firstParagraphEnd + 4);
    } else {
      // If no paragraph found, append at the beginning
      articleContent = additionalImagesHTML + '\n' + articleContent;
    }
  }

  const articleUrl = `https://www.flaesch.info/${draft.fileName}`;
  const articleDate = new Date(draft.createdAt).toISOString();
  const articleImage = (draft.images && draft.images.length > 0) ? draft.images[0] : 'https://www.flaesch.info/logo.png';
  const excerpt = draft.subtitle || draft.content.substring(0, 150);

  return `<!DOCTYPE html>
<html lang="de-CH">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Primary Meta Tags -->
    <title>${draft.title} | Fläsch Info - Satirische Nachrichten aus Fläsch GR</title>
    <meta name="title" content="${draft.title} | Fläsch Info">
    <meta name="description" content="${excerpt}">
    <meta name="keywords" content="Fläsch, Flaesch, Fläsch ${draft.category}, ${draft.title}, Fläsch News, Flaesch News, Fläsch Satire, Gemeinde Fläsch, Fläsch GR, Graubünden, Schweiz, Dorf Fläsch">
    <meta name="author" content="${draft.authorDisplayName || 'Fläsch Info'}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${articleUrl}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${articleUrl}">
    <meta property="og:title" content="${draft.title}">
    <meta property="og:description" content="${excerpt}">
    <meta property="og:image" content="${articleImage}">
    <meta property="og:locale" content="de_CH">
    <meta property="og:site_name" content="Fläsch Info">
    <meta property="article:published_time" content="${articleDate}">
    <meta property="article:author" content="${draft.authorDisplayName || 'Fläsch Info'}">
    <meta property="article:section" content="${categoryLabel}">
    <meta property="article:tag" content="Fläsch">
    <meta property="article:tag" content="Satire">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${articleUrl}">
    <meta property="twitter:title" content="${draft.title}">
    <meta property="twitter:description" content="${excerpt}">
    <meta property="twitter:image" content="${articleImage}">

    <link rel="icon" type="image/svg+xml" href="/favicon.svg">

    <!-- Structured Data / Schema.org -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SatiricalArticle",
      "headline": "${draft.title}",
      "alternativeHeadline": "${draft.subtitle || ''}",
      "image": "${articleImage}",
      "datePublished": "${articleDate}",
      "dateModified": "${new Date(draft.updatedAt).toISOString()}",
      "author": {
        "@type": "Person",
        "name": "${draft.authorDisplayName || 'Fläsch Info'}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Fläsch Info",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.flaesch.info/logo.png"
        }
      },
      "description": "${excerpt}",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "${articleUrl}"
      },
      "articleSection": "${categoryLabel}",
      "keywords": "Fläsch, Flaesch, ${draft.category}, Satire, Graubünden, Schweiz, Gemeinde Fläsch",
      "inLanguage": "de-CH"
    }
    </script>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap" rel="stylesheet">

    <!-- Shared Design System -->
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/comments.css">
    <link rel="stylesheet" href="/cookie-consent.css">

    <style>:root { --category-color: ${categoryColor}; }</style>
</head>
<body>
    <!-- Top Info Bar -->
    <div class="info-bar">
        <div class="info-bar-content">
            <div>Fläsch, Graubünden, Schweiz</div>
            <div class="satire-badge">SATIRE</div>
        </div>
    </div>

    <!-- Navigation -->
    <nav>
        <div class="nav-container">
            <a href="/index.html" class="nav-logo">
                <img src="/logo.png" alt="Fläsch Info Logo">
            </a>
            <button type="button" class="nav-toggle" title="Navigation öffnen" aria-label="Navigation öffnen" onclick="document.querySelector('.nav-links').classList.toggle('open')">
                <span></span><span></span><span></span>
            </button>
            <div class="nav-links">
                <a href="/index.html#geschichten">Geschichten</a>
                <a href="/ueber-uns.html">Über uns</a>
                <a href="/kontakt.html">Kontakt</a>
                <a href="/my-articles.html" class="nav-admin-link">Admin</a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero-article">
        ${heroImage ? `<div class="hero-bg" style="background-image: url('${heroImage}')"></div>` : ''}
        <div class="hero-content">
            <span class="badge badge-${draft.category}">${categoryLabel}</span>
            <h1>${draft.title}</h1>
            ${draft.subtitle ? `<p class="article-subtitle">${draft.subtitle}</p>` : ''}
            <div class="article-meta">
                ${draft.authorDisplayName ? `<span>${draft.authorDisplayName}</span>` : ''}
                <span>${new Date(draft.createdAt).toLocaleDateString('de-CH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
        </div>
    </section>

    <!-- Main Content -->
    <article class="article-content">
        ${articleContent}
    </article>

    <!-- Like Section -->
    <div class="like-section">
        <button id="likeButton" class="like-button">Gefällt mir</button>
        <span class="like-count"><span id="likeCount">0</span> Likes</span>
    </div>

    <!-- Comments Section -->
    <div class="comments-section">
        <h2>Kommentare</h2>

        <!-- Comment Form (nur wenn eingeloggt) -->
        <div id="commentFormSection" style="display: none;">
            <form id="commentForm" class="comment-form">
                <div class="comment-mode-selector">
                    <label>
                        <input type="radio" name="commentMode" value="manual" checked>
                        <span>Selbst schreiben</span>
                    </label>
                    <label>
                        <input type="radio" name="commentMode" value="claude">
                        <span>Mit Claude-Hilfe</span>
                    </label>
                </div>

                <textarea
                    id="commentText"
                    placeholder="Schreib einen lustigen Kommentar... (Bei Claude-Hilfe: Gib Stichworte ein)"
                    required
                ></textarea>

                <button type="submit" id="submitCommentBtn" class="submit-comment-btn">
                    Kommentar absenden
                </button>
            </form>
        </div>

        <!-- Login Prompt (wenn nicht eingeloggt) -->
        <div id="loginPrompt" class="login-prompt">
            <p>
                <strong>Du musst angemeldet sein, um zu kommentieren</strong><br><br>
                <a href="/admin.html">Zum Login</a> | <a href="/register.html">Registrieren</a>
            </p>
        </div>

        <!-- Comments List -->
        <div class="comments-list">
            <h3>Alle Kommentare:</h3>
            <div id="commentsContainer">
                <p class="loading">Lade Kommentare...</p>
            </div>
        </div>
    </div>

    <!-- JavaScript Config -->
    <script>
        window.ARTICLE_SLUG = '${draft.slug || draft.fileName.replace('.html', '')}';
        window.ARTICLE_TITLE = '${draft.title.replace(/'/g, "\\'")}';
    </script>
    <script src="/comments.js"></script>

    <!-- Footer -->
    <footer>
        <div class="footer-content">
            <p><strong>Fläsch Info</strong> — Satirische Geschichten aus Fläsch</p>
            <p>&copy; ${new Date().getFullYear()} Fläsch mittendrin — oder doch daneben?</p>
            <div class="footer-disclaimer">
                Diese Webseite ist Satire. Alle Geschichten sind frei erfunden und dienen ausschliesslich der Unterhaltung.
                Erstellt mit KI — Inhalte werden von künstlicher Intelligenz generiert.
            </div>
            <p style="margin-top: var(--space-4);">
                <a href="/index.html">Zurück zur Startseite</a>
            </p>
        </div>
    </footer>

    <script src="/cookie-consent.js"></script>
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

    // Get user from Redis to check current role (role might have changed since JWT was issued)
    const usersJson = await redis.get('users');
    const users = usersJson ? JSON.parse(usersJson) : [];
    const userAccount = users.find(u => u.username === session.username);

    // Check if user has author or admin role
    if (!userAccount || (userAccount.role !== 'author' && userAccount.role !== 'admin')) {
      return res.status(403).json({
        error: 'Du hast keine Berechtigung, Artikel zu veröffentlichen. Bitte kontaktiere einen Administrator.'
      });
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
    const isAdmin = session.role === 'admin';
    if (draft.author !== session.username && !isAdmin) {
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

    // Prepare tree array with all files to commit
    const treeItems = [
      {
        path: fileName,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      }
    ];

    // Step 3b: Update articles.json - create blob
    try {
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
      if (articlesJsonResponse.ok) {
        const articlesJsonData = await articlesJsonResponse.json();
        const articlesContent = Buffer.from(articlesJsonData.content, 'base64').toString('utf-8');
        articles = JSON.parse(articlesContent);
      }

      // Helper function to calculate similarity between two strings (Levenshtein-based)
      function calculateSimilarity(str1, str2) {
        const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
        const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');

        // If strings are very short, use exact match
        if (s1.length < 10 || s2.length < 10) {
          return s1 === s2 ? 1.0 : 0.0;
        }

        // Calculate common words
        const words1 = str1.toLowerCase().split(/\s+/);
        const words2 = str2.toLowerCase().split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w) && w.length > 3);

        // If many common significant words, likely similar
        const avgLength = (words1.length + words2.length) / 2;
        const similarity = commonWords.length / avgLength;

        return similarity;
      }

      // Check if article already exists (by fileName or similar title)
      const existingIndex = articles.findIndex(a => a.fileName === fileName);

      // Check for similar titles (potential duplicates)
      const similarArticle = articles.find(a => {
        if (a.fileName === fileName) return false; // Skip self
        const similarity = calculateSimilarity(a.title, draft.title);
        return similarity > 0.5; // If more than 50% similar, flag as potential duplicate
      });

      if (similarArticle && existingIndex < 0) {
        console.warn(`WARNING: Similar article found!`);
        console.warn(`New: "${draft.title}" (${fileName})`);
        console.warn(`Existing: "${similarArticle.title}" (${similarArticle.fileName})`);
        console.warn(`Similarity: ${(calculateSimilarity(similarArticle.title, draft.title) * 100).toFixed(0)}%`);
        // Continue anyway but log the warning for admin review
      }

      // Generate excerpt from subtitle or clean HTML content
      let excerpt = '';
      if (draft.subtitle) {
        excerpt = draft.subtitle;
      } else {
        // Extract text from HTML content, remove HTML tags and URLs
        const cleanContent = draft.content
          .replace(/<[^>]*>/g, ' ') // Remove HTML tags
          .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        excerpt = cleanContent.substring(0, 150) + '...';
      }

      const articleData = {
        title: draft.title,
        subtitle: draft.subtitle || '',
        fileName: fileName,
        category: draft.category,
        excerpt: excerpt,
        date: draft.createdAt ? new Date(draft.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        image: draft.images && draft.images.length > 0 ? draft.images[0] : null,
        author: draft.author,
        authorDisplayName: draft.authorDisplayName
      };

      if (existingIndex >= 0) {
        // Update existing article
        articles[existingIndex] = articleData;
      } else {
        // Add new article at the beginning
        articles.unshift(articleData);
      }

      // Create blob for updated articles.json
      const articlesJsonBlobResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: Buffer.from(JSON.stringify(articles, null, 2)).toString('base64'),
            encoding: 'base64'
          })
        }
      );

      if (articlesJsonBlobResponse.ok) {
        const articlesJsonBlobData = await articlesJsonBlobResponse.json();
        treeItems.push({
          path: 'articles.json',
          mode: '100644',
          type: 'blob',
          sha: articlesJsonBlobData.sha
        });
      }
    } catch (articlesError) {
      console.error('Failed to update articles.json (non-critical):', articlesError);
    }

    // Step 3c: Auto-update context in Redis
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const extractionPrompt = `Analysiere diesen satirischen Artikel von "Fläsch Info" und extrahiere eine kurze Zusammenfassung (max 2-3 Sätze).

**Artikel-Titel:** ${draft.title}
**Kategorie:** ${draft.category}
**Inhalt:** ${draft.content}

Fasse das Hauptereignis in 2-3 Sätzen zusammen. Nenne wichtige Zahlen, Abstimmungsergebnisse oder Zitate falls vorhanden. Schreibe als Fliesstext, keine Bulletpoints.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: extractionPrompt
        }]
      });

      const extractedContext = message.content[0].text;
      await addEventFromArticle(draft.title, draft.category, extractedContext);
      console.log('Context updated in Redis successfully');
    } catch (contextError) {
      console.error('Context update failed (non-critical):', contextError);
    }

    // Step 4: Create a new tree with ALL files (article + articles.json + context)
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
          tree: treeItems
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
          message: `Publish: ${draft.title}\n\nAutor: ${draft.authorDisplayName}\nKategorie: ${draft.category}\n\nIncludes: article HTML, articles.json update, context update`,
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
