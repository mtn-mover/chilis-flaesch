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

    // Check if user is admin (check both JWT role and database)
    if (decoded.role !== 'admin') {
      console.error('User is not admin:', decoded.username, 'JWT role:', decoded.role);
      return res.status(403).json({ error: 'Nur Admins können Zeitungen generieren' });
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
          const imageMatch = html.match(/<img[^>]*class="hero-image"[^>]*src="([^"]*)"/) ||
                            html.match(/<img[^>]*src="([^"]*)"[^>]*>/);
          const categoryMatch = html.match(/<span class="hero-category"[^>]*>(.*?)<\/span>/) ||
                               html.match(/<span class="story-category[^"]*"[^>]*>(.*?)<\/span>/);

          articles.push({
            fileName,
            title: titleMatch ? titleMatch[1].trim() : '',
            subtitle: subtitleMatch ? subtitleMatch[1].trim() : '',
            content: contentMatch ? contentMatch[1].trim() : '',
            image: imageMatch ? imageMatch[1] : null,
            category: categoryMatch ? categoryMatch[1].trim() : ''
          });
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

      // Set content with shorter timeout and load strategy
      await page.setContent(newspaperHTML, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      console.log('Page content loaded, generating PDF...');

      const pdf = await page.pdf({
        format: 'A3',
        landscape: true,
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        }
      });

      console.log('PDF generated, size:', pdf.length, 'bytes');

      await browser.close();

      // Return PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="flaesch-info-ausgabe-${issueNumber}.pdf"`);
      return res.send(pdf);

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

    /* 4-page layout: Each page is half of A3 landscape (A4 portrait) */
    .newspaper {
      width: 420mm;
      height: 297mm;
      position: relative;
      background: white;
    }

    .page {
      width: 210mm;
      height: 297mm;
      position: absolute;
      padding: 15mm;
      overflow: hidden;
      border-right: 1px dashed #ccc;
    }

    .page:last-child {
      border-right: none;
    }

    /* Page 1: Cover (right outer) */
    .page-1 {
      right: 0;
    }

    /* Page 4: Back (left outer) */
    .page-4 {
      left: 0;
    }

    /* Header */
    .masthead {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }

    .newspaper-title {
      font-size: 48pt;
      font-weight: bold;
      font-family: 'Georgia', serif;
      letter-spacing: 2px;
      margin-bottom: 5px;
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

    /* Main headline (cover) */
    .main-headline {
      font-size: 36pt;
      font-weight: bold;
      line-height: 1.1;
      margin: 20px 0 10px 0;
      font-family: 'Georgia', serif;
    }

    .main-subtitle {
      font-size: 16pt;
      font-style: italic;
      margin-bottom: 15px;
      color: #333;
    }

    /* Article styles */
    .article {
      margin-bottom: 20px;
      break-inside: avoid;
    }

    .article-headline {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 5px;
      line-height: 1.2;
    }

    .article-category {
      display: inline-block;
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      padding: 2px 6px;
      margin-bottom: 8px;
      background: #000;
      color: white;
    }

    .article-image {
      width: 100%;
      height: auto;
      margin: 10px 0;
      border: 1px solid #ddd;
    }

    .article-content {
      font-size: 10pt;
      text-align: justify;
      columns: 2;
      column-gap: 15px;
    }

    .article-content p {
      margin-bottom: 8px;
    }

    /* Single column for cover story */
    .cover-content {
      columns: 1;
      font-size: 11pt;
    }

    /* Footer */
    .page-footer {
      position: absolute;
      bottom: 15mm;
      left: 15mm;
      right: 15mm;
      text-align: center;
      font-size: 8pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 5px;
    }

    /* Print page 2-3 (inside spread) on second page */
    @media print {
      .newspaper {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>

<!-- First A3 sheet: Page 4 (left) and Page 1 (right) -->
<div class="newspaper">
  <!-- Page 4: Back page (left outer) -->
  <div class="page page-4">
    <div class="masthead">
      <div class="newspaper-title">${title}</div>
      <div class="tagline">Satirische Nachrichten aus Fläsch GR</div>
      <div class="issue-info">Ausgabe ${issueNumber} • ${issueDate}</div>
    </div>

    ${articles.slice(3).map(article => `
      <div class="article">
        <div class="article-category">${escapeHTML(article.category)}</div>
        <h2 class="article-headline">${escapeHTML(article.title)}</h2>
        ${article.subtitle ? `<p class="article-subtitle" style="font-style: italic; font-size: 1rem; margin: 0.5rem 0; color: #333;">${escapeHTML(article.subtitle)}</p>` : ''}
        ${article.image ? `<img src="${escapeHTML(article.image)}" class="article-image" />` : ''}
        <div class="article-content">
          ${escapeHTML(stripHTML(article.content).substring(0, 800))}...
        </div>
      </div>
    `).join('')}

    <div class="page-footer">
      www.flaesch.info • Satirische Nachrichten aus Fläsch • Seite 4
    </div>
  </div>

  <!-- Page 1: Cover page (right outer) -->
  <div class="page page-1">
    <div class="masthead">
      <div class="newspaper-title">${title}</div>
      <div class="tagline">Satirische Nachrichten aus Fläsch GR</div>
      <div class="issue-info">Ausgabe ${issueNumber} • ${issueDate}</div>
    </div>

    ${mainHeadline ? `<h1 class="main-headline">${escapeHTML(mainHeadline)}</h1>` : ''}
    ${subtitle ? `<p class="main-subtitle">${escapeHTML(subtitle)}</p>` : ''}

    ${coverImage ? `<img src="${escapeHTML(coverImage)}" class="article-image" style="max-height: 150mm;" />` : ''}

    ${articles.slice(0, 1).map(article => `
      <div class="article">
        <div class="article-category">${escapeHTML(article.category)}</div>
        <h2 class="article-headline">${escapeHTML(article.title)}</h2>
        ${article.subtitle ? `<p class="article-subtitle" style="font-style: italic; font-size: 1.1rem; margin: 0.5rem 0; color: #333;">${escapeHTML(article.subtitle)}</p>` : ''}
        ${!coverImage && article.image ? `<img src="${escapeHTML(article.image)}" class="article-image" />` : ''}
        <div class="cover-content">
          ${escapeHTML(stripHTML(article.content).substring(0, 1000))}...
        </div>
      </div>
    `).join('')}

    <div class="page-footer">
      www.flaesch.info • Satirische Nachrichten aus Fläsch • Seite 1
    </div>
  </div>
</div>

<!-- Second A3 sheet: Page 2 (left) and Page 3 (right) -->
<div class="newspaper">
  <!-- Page 2: Inside left -->
  <div class="page page-4">
    <div class="masthead">
      <div class="newspaper-title">${title}</div>
      <div class="issue-info">Ausgabe ${issueNumber} • ${issueDate}</div>
    </div>

    ${articles.slice(1, 2).map(article => `
      <div class="article">
        <div class="article-category">${escapeHTML(article.category)}</div>
        <h2 class="article-headline">${escapeHTML(article.title)}</h2>
        ${article.subtitle ? `<p class="article-subtitle" style="font-style: italic; font-size: 1rem; margin: 0.5rem 0; color: #333;">${escapeHTML(article.subtitle)}</p>` : ''}
        ${article.image ? `<img src="${escapeHTML(article.image)}" class="article-image" />` : ''}
        <div class="article-content">
          ${escapeHTML(stripHTML(article.content).substring(0, 1500))}...
        </div>
      </div>
    `).join('')}

    <div class="page-footer">
      www.flaesch.info • Seite 2
    </div>
  </div>

  <!-- Page 3: Inside right -->
  <div class="page page-1">
    <div class="masthead">
      <div class="newspaper-title">${title}</div>
      <div class="issue-info">Ausgabe ${issueNumber} • ${issueDate}</div>
    </div>

    ${articles.slice(2, 3).map(article => `
      <div class="article">
        <div class="article-category">${escapeHTML(article.category)}</div>
        <h2 class="article-headline">${escapeHTML(article.title)}</h2>
        ${article.subtitle ? `<p class="article-subtitle" style="font-style: italic; font-size: 1rem; margin: 0.5rem 0; color: #333;">${escapeHTML(article.subtitle)}</p>` : ''}
        ${article.image ? `<img src="${escapeHTML(article.image)}" class="article-image" />` : ''}
        <div class="article-content">
          ${escapeHTML(stripHTML(article.content).substring(0, 1500))}...
        </div>
      </div>
    `).join('')}

    <div class="page-footer">
      www.flaesch.info • Seite 3
    </div>
  </div>
</div>

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
