#!/usr/bin/env node
// One-time migration: update existing article HTML files to use shared styles.css
// Run: node scripts/migrate-articles.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Pages that are NOT articles (skip these)
const SKIP_FILES = new Set([
    'index.html', 'admin.html', 'create-article.html', 'my-articles.html',
    'dashboard.html', 'admin-comments.html', 'admin-users.html', 'admin-context.html',
    'register.html', 'activate.html', 'reset-password.html', 'kontakt.html',
    'ueber-uns.html', 'create-newspaper.html', 'debug-session.html'
]);

// Legacy articles with bespoke designs (leave untouched)
const LEGACY_FILES = new Set([
    'steuerdebakel.html', 'chilis-restaurant.html', 'migros-fail.html'
]);

const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">`;

const files = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html'))
    .filter(f => !SKIP_FILES.has(f))
    .filter(f => !LEGACY_FILES.has(f));

let migrated = 0;
let skipped = 0;
let errors = 0;

for (const file of files) {
    const filePath = path.join(ROOT, file);
    try {
        let html = fs.readFileSync(filePath, 'utf8');

        // Skip if already migrated (has /styles.css reference)
        if (html.includes('href="/styles.css"') || html.includes('href="styles.css"')) {
            console.log(`SKIP (already migrated): ${file}`);
            skipped++;
            continue;
        }

        // Skip if no <style> tag (not a standard article)
        if (!html.includes('<style>')) {
            console.log(`SKIP (no inline styles): ${file}`);
            skipped++;
            continue;
        }

        // Extract --primary-color from inline CSS
        const colorMatch = html.match(/--primary-color:\s*(#[0-9a-fA-F]+)/);
        const categoryColor = colorMatch ? colorMatch[1] : '#B8845A';

        // Remove the entire <style>...</style> block
        html = html.replace(/<style>[\s\S]*?<\/style>/, `${FONTS_LINK}
    <style>
        :root { --category-color: ${categoryColor}; }
    </style>`);

        // Update emoji-heavy UI elements
        html = html.replace(/📍 Fläsch, Graubünden, Schweiz/g, 'Fläsch, Graubünden, Schweiz');
        html = html.replace(/⚠️ SATIRE/g, 'SATIRE');
        html = html.replace(/🍷 <strong>Fläsch Info<\/strong>/g, '<strong>Fläsch Info</strong>');
        html = html.replace(/⚠️ Diese Webseite/g, 'Diese Webseite');
        html = html.replace(/🤖 Diese Webseite/g, 'Diese Webseite');
        html = html.replace(/🔐 /g, '');

        // Update nav links to remove emojis
        html = html.replace(/>📰 Unsere Geschichten</g, '>Geschichten<');
        html = html.replace(/>Unsere Geschichten</g, '>Geschichten<');

        // Add hamburger button if nav-toggle doesn't exist yet
        if (!html.includes('nav-toggle')) {
            html = html.replace(
                /(<div class="nav-links">)/,
                '<button type="button" class="nav-toggle" title="Navigation" aria-label="Navigation" onclick="document.querySelector(\'.nav-links\').classList.toggle(\'open\')"><span></span><span></span><span></span></button>\n            $1'
            );
        }

        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`MIGRATED: ${file} (category color: ${categoryColor})`);
        migrated++;
    } catch (err) {
        console.error(`ERROR: ${file}: ${err.message}`);
        errors++;
    }
}

console.log(`\nDone! Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
