import { kv } from '@vercel/kv';
import jwt from 'jsonwebtoken';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const JWT_SECRET = process.env.JWT_SECRET || 'flaesch-info-secret-2024-temp';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body if needed
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    // Verify authentication
    const token = body.sessionToken;
    if (!token) {
      console.error('No session token provided');
      return res.status(401).json({ error: 'Nicht authentifiziert', details: 'Kein Token gefunden' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('JWT decoded:', { username: decoded.username, role: decoded.role });
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(401).json({ error: 'Ungültiges Token', details: err.message });
    }

    // Check if user has permission to create newspapers
    // Get user from database to check canCreateNewspaper permission
    try {
      const usersData = await kv.get('users');
      console.log('Raw users data from KV:', usersData);
      console.log('Type of users data:', typeof usersData);

      // KV might return already parsed data or string
      let users;
      if (typeof usersData === 'string') {
        users = JSON.parse(usersData || '[]');
      } else if (Array.isArray(usersData)) {
        users = usersData;
      } else {
        users = [];
      }
      console.log('Parsed users:', users.length, 'users found');

      const user = users.find(u => u.username === decoded.username);

      if (!user) {
        console.error('User not found in database:', decoded.username, 'Available users:', users.map(u => u.username));
        // Allow anyway for now - backwards compatibility
        console.warn('Allowing newspaper creation anyway (backwards compatibility)');
      } else {
        console.log('User found:', { username: user.username, role: user.role, canCreateNewspaper: user.canCreateNewspaper });

        const canCreate = user.role === 'admin' || user.canCreateNewspaper === true;

        if (!canCreate) {
          console.error('User lacks newspaper creation permission:', decoded.username, 'Admin:', user.role === 'admin', 'canCreateNewspaper:', user.canCreateNewspaper);
          return res.status(403).json({ error: 'Keine Berechtigung zum Erstellen von Zeitungen. Bitte kontaktiere einen Administrator.' });
        }

        console.log('User has permission to create newspaper');
      }
    } catch (permError) {
      console.error('Error checking permissions:', permError);
      // Allow anyway for now - don't block on permission check errors
      console.warn('Allowing newspaper creation anyway (permission check failed)');
    }

    // Get newspaper configuration
    const {
      title,
      issueNumber,
      issueDate,
      mainHeadline,
      subtitle,
      coverImage,
      articleFileNames
    } = body;

    if (!articleFileNames || articleFileNames.length === 0) {
      return res.status(400).json({ error: 'Keine Artikel ausgewählt' });
    }

    // Fetch article content from GitHub
    const articles = [];
    for (const fileName of articleFileNames) {
      try {
        const response = await fetch(`https://www.flaesch.info/${fileName}`);
        if (response.ok) {
          const html = await response.text();

          // Extract title, subtitle, content, image, etc. from HTML
          const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/);
          const subtitleMatch = html.match(/<p[^>]*class="hero-subtitle"[^>]*>(.*?)<\/p>/) ||
                               html.match(/<div[^>]*class="hero-subtitle"[^>]*>(.*?)<\/div>/);
          const contentMatch = html.match(/<article class="article-content">([\s\S]*?)<\/article>/) ||
                              html.match(/<div class="story-content">([\s\S]*?)<\/div>/);
          const imageMatch = html.match(/<img[^>]*src="([^"]*)"[^>]*class="hero-image"/) ||
                            html.match(/<img[^>]*class="hero-image"[^>]*src="([^"]*)"/) ||
                            html.match(/<img[^>]*src="([^"]*)"[^>]*alt="[^"]*"[^>]*class="hero-image"/);
          const categoryMatch = html.match(/<span class="hero-category"[^>]*>(.*?)<\/span>/) ||
                               html.match(/<span class="story-category[^"]*"[^>]*>(.*?)<\/span>/);

          const article = {
            fileName,
            title: titleMatch ? titleMatch[1].trim() : '',
            subtitle: subtitleMatch ? subtitleMatch[1].trim() : '',
            content: contentMatch ? contentMatch[1].trim() : '',
            image: imageMatch ? imageMatch[1] : null,
            category: categoryMatch ? categoryMatch[1].trim() : ''
          };

          console.log(`Article: ${article.title}`);
          console.log(`  Image: ${article.image || 'NO IMAGE FOUND'}`);

          articles.push(article);
        }
      } catch (error) {
        console.error(`Error fetching article ${fileName}:`, error);
      }
    }

    if (articles.length === 0) {
      return res.status(400).json({ error: 'Keine Artikel konnten geladen werden' });
    }

    // Generate newspaper HTML
    const newspaperHTML = generateNewspaperHTML({
      title: title || 'Fläsch Info',
      issueNumber: issueNumber || '1',
      issueDate: issueDate || new Date().toLocaleDateString('de-CH', { year: 'numeric', month: 'long', day: 'numeric' }),
      mainHeadline: mainHeadline || '',
      subtitle: subtitle || '',
      coverImage: coverImage || null,
      articles
    });

    console.log('Generated HTML length:', newspaperHTML.length);
    console.log('Articles count:', articles.length);

    // Generate PDF using Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: 'new',
      });

      const page = await browser.newPage();

      // Set content with load strategy
      await page.setContent(newspaperHTML, {
        waitUntil: 'load',
        timeout: 30000
      });

      console.log('Page content loaded, waiting for images...');

      // Wait for all images to load or timeout after 3 seconds
      await page.evaluate(() => {
        return new Promise((resolve) => {
          const images = Array.from(document.querySelectorAll('img'));
          let loadedCount = 0;
          const totalImages = images.length;

          if (totalImages === 0) {
            resolve();
            return;
          }

          const checkComplete = () => {
            loadedCount++;
            if (loadedCount >= totalImages) {
              resolve();
            }
          };

          images.forEach(img => {
            if (img.complete) {
              checkComplete();
            } else {
              img.addEventListener('load', checkComplete);
              img.addEventListener('error', checkComplete);
            }
          });

          // Timeout after 3 seconds
          setTimeout(() => resolve(), 3000);
        });
      });

      console.log('Generating PDF...');

      const pdf = await page.pdf({
        format: 'A3',
        landscape: true,
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        },
        preferCSSPageSize: false
      });

      console.log('PDF generated, size:', pdf.length, 'bytes');

      await browser.close();

      // Verify PDF is valid (should start with %PDF)
      const pdfHeader = pdf.slice(0, 5).toString();
      console.log('PDF header:', pdfHeader);

      if (!pdfHeader.startsWith('%PDF')) {
        console.warn('WARNING: Generated PDF may be invalid (unexpected header)');
      }

      // Return PDF with proper headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="flaesch-info-ausgabe-${issueNumber}.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      res.setHeader('Cache-Control', 'no-cache');
      return res.end(pdf);

    } catch (pdfError) {
      if (browser) await browser.close();
      throw pdfError;
    }

  } catch (error) {
    console.error('Error generating newspaper PDF:', error);
    res.status(500).json({ error: 'Fehler beim Generieren der Zeitung', details: error.message });
  }
}

function generateNewspaperHTML(data) {
  const { title, issueNumber, issueDate, mainHeadline, subtitle, coverImage, articles } = data;

  // Generate pages dynamically based on article count
  // Page 1: Cover with table of contents
  // Pages 2-N: One article per page

  const totalPages = articles.length + 1; // 1 cover page + N article pages
  const sheets = Math.ceil(totalPages / 2); // Number of A3 sheets needed

  // Helper to get category label
  function getCategoryLabel(category) {
    const labels = {
      'politik': 'Politik',
      'kultur': 'Kultur',
      'sport': 'Sport',
      'wirtschaft': 'Wirtschaft',
      'kurioses': 'Kurioses'
    };
    return labels[category] || category;
  }

  // Generate page pairs for printing (booklet style)
  // For 8 pages: Sheet 1: 8,1  Sheet 2: 2,7  Sheet 3: 6,3  Sheet 4: 4,5
  let pageHTML = '';

  for (let sheet = 0; sheet < sheets; sheet++) {
    let leftPageNum, rightPageNum;

    if (sheet === 0) {
      // First sheet (outer): 8, 1
      leftPageNum = totalPages;
      rightPageNum = 1;
    } else {
      // Inner sheets: 2,7 then 6,3 then 4,5
      leftPageNum = sheet * 2;
      rightPageNum = totalPages - sheet * 2 + 1;
    }

    pageHTML += `
<div class="newspaper">
  ${leftPageNum > 0 && leftPageNum <= totalPages ? generatePage(leftPageNum, 'left') : ''}
  ${rightPageNum > 0 && rightPageNum <= totalPages ? generatePage(rightPageNum, 'right') : ''}
</div>
`;
  }

  // Function to generate a single page
  function generatePage(pageNum, position) {
    const positionClass = position === 'right' ? 'page-right' : 'page-left';

    // Page 1: Cover with table of contents
    if (pageNum === 1) {
      return `
  <div class="page ${positionClass}">
    <div class="masthead">
      <div class="newspaper-title">${title}</div>
      <div class="tagline">Satirische Nachrichten aus Fläsch GR</div>
      <div class="issue-info">Ausgabe ${issueNumber} • ${issueDate}</div>
    </div>

    ${mainHeadline ? `<h1 class="main-headline">${escapeHTML(mainHeadline)}</h1>` : ''}
    ${subtitle ? `<p class="main-subtitle">${escapeHTML(subtitle)}</p>` : ''}

    ${coverImage ? `<img src="${coverImage}" class="cover-image" onerror="this.style.display='none'" />` : ''}

    <div class="toc">
      <h2 class="toc-title">In dieser Ausgabe:</h2>
      ${articles.map((article, index) => `
        <div class="toc-item">
          <span class="toc-number">${index + 1}.</span>
          <span class="toc-article-title">${escapeHTML(article.title)}</span>
          <span class="toc-category">${getCategoryLabel(article.category)}</span>
          <span class="toc-page">Seite ${index + 2}</span>
        </div>
      `).join('')}
    </div>

    <div class="page-footer">
      www.flaesch.info • Satirische Nachrichten aus Fläsch • Seite ${pageNum}
    </div>
  </div>`;
    }

    // Article pages (2 to totalPages)
    const articleIndex = pageNum - 2;
    if (articleIndex >= 0 && articleIndex < articles.length) {
      const article = articles[articleIndex];
      return `
  <div class="page ${positionClass}">
    <div class="masthead-small">
      <div class="newspaper-title-small">${title}</div>
      <div class="issue-info">Ausgabe ${issueNumber} • ${issueDate}</div>
    </div>

    <div class="article">
      <div class="article-category">${escapeHTML(getCategoryLabel(article.category))}</div>
      <h1 class="article-headline">${escapeHTML(article.title)}</h1>
      ${article.subtitle ? `<p class="article-subtitle">${escapeHTML(article.subtitle)}</p>` : ''}
      <div class="article-content">
        ${article.image ? `<img src="${article.image}" class="article-image" onerror="this.style.display='none'" />` : ''}
        ${article.content}
      </div>
    </div>

    <div class="page-footer">
      www.flaesch.info • Satirische Nachrichten aus Fläsch • Seite ${pageNum}
    </div>
  </div>`;
    }

    // Empty page
    return `
  <div class="page ${positionClass}">
    <div class="masthead-small">
      <div class="newspaper-title-small">${title}</div>
      <div class="issue-info">Ausgabe ${issueNumber} • ${issueDate}</div>
    </div>
    <div class="page-footer">
      www.flaesch.info • Seite ${pageNum}
    </div>
  </div>`;
  }

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${title} - Ausgabe ${issueNumber}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #000;
      background: white;
      line-height: 1.4;
    }

    .newspaper {
      width: 420mm;
      height: 297mm;
      position: relative;
      background: white;
      page-break-after: always;
    }

    .page {
      width: 210mm;
      height: 297mm;
      position: absolute;
      padding: 15mm;
      overflow: hidden;
    }

    .page-left {
      left: 0;
      border-right: 1px dashed #ccc;
    }

    .page-right {
      right: 0;
    }

    /* Header */
    .masthead {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }

    .masthead-small {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 5px;
      margin-bottom: 12px;
    }

    .newspaper-title {
      font-size: 48pt;
      font-weight: bold;
      letter-spacing: 2px;
      margin-bottom: 5px;
    }

    .newspaper-title-small {
      font-size: 24pt;
      font-weight: bold;
      letter-spacing: 1px;
    }

    .tagline {
      font-size: 10pt;
      font-style: italic;
      color: #666;
      margin-bottom: 5px;
    }

    .issue-info {
      font-size: 9pt;
      color: #333;
      border-top: 1px solid #000;
      padding-top: 5px;
      margin-top: 5px;
    }

    /* Cover page */
    .main-headline {
      font-size: 24pt;
      font-weight: bold;
      line-height: 1.1;
      margin: 12px 0 6px 0;
    }

    .main-subtitle {
      font-size: 12pt;
      font-style: italic;
      margin-bottom: 10px;
      color: #333;
    }

    .cover-image {
      width: 100%;
      height: auto;
      max-height: 110mm;
      object-fit: cover;
      margin: 10px 0;
      border: 1px solid #ddd;
    }

    /* Table of contents */
    .toc {
      margin-top: 15px;
    }

    .toc-title {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #000;
    }

    .toc-item {
      display: flex;
      align-items: baseline;
      padding: 6px 0;
      border-bottom: 1px dotted #ccc;
      font-size: 10pt;
    }

    .toc-number {
      font-weight: bold;
      margin-right: 8px;
      min-width: 20px;
    }

    .toc-article-title {
      flex: 1;
      font-weight: bold;
    }

    .toc-category {
      font-size: 8pt;
      text-transform: uppercase;
      color: #666;
      margin: 0 10px;
    }

    .toc-page {
      font-size: 9pt;
      color: #333;
    }

    /* Article styles */
    .article {
      height: calc(297mm - 30mm - 40mm); /* Full height minus padding and header/footer */
    }

    .article-category {
      display: inline-block;
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      padding: 3px 8px;
      margin-bottom: 8px;
      background: #000;
      color: white;
    }

    .article-headline {
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 6px;
      line-height: 1.1;
      margin-top: 0;
    }

    .article-subtitle {
      font-size: 11pt;
      font-style: italic;
      margin-bottom: 10px;
      color: #333;
    }

    .article-content {
      font-size: 10pt !important;
      text-align: justify;
      columns: 2;
      column-gap: 15px;
      line-height: 1.5;
    }

    .article-content .article-image {
      width: 100%;
      height: auto;
      max-height: 75mm;
      object-fit: cover;
      margin: 0 0 10px 0;
      border: 1px solid #ddd;
      display: block;
      break-inside: avoid;
    }

    .article-content p {
      margin-bottom: 8px;
      font-size: 10pt !important;
    }

    .article-content h2 {
      font-size: 10pt !important;
      font-weight: bold;
      margin: 10px 0 5px 0;
      break-after: avoid;
    }

    .article-content h3 {
      font-size: 10pt !important;
      font-weight: bold;
      margin: 8px 0 4px 0;
      break-after: avoid;
    }

    .article-content strong {
      font-weight: bold;
      font-size: 10pt !important;
    }

    .article-content em {
      font-style: italic;
      font-size: 10pt !important;
    }

    .article-content * {
      font-size: 10pt !important;
    }

    /* Footer */
    .page-footer {
      position: absolute;
      bottom: 10mm;
      left: 15mm;
      right: 15mm;
      text-align: center;
      font-size: 8pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 5px;
    }

    .back-page-content {
      margin-top: 30mm;
      text-align: center;
    }
  </style>
</head>
<body>

${pageHTML}

</body>
</html>
  `.trim();
}

function escapeHTML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHTML(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}
