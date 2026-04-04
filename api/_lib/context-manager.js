// Context Manager - manages structured context data in Redis
// Used for LLM article generation and admin context editing

const Redis = require('ioredis');

let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  const { kv } = require('@vercel/kv');
  redis = kv;
}

const CONTEXT_KEY = 'context:sections';

/**
 * Get the full structured context from Redis
 * @returns {Object|null} The context object or null if not found
 */
async function getContext() {
  const data = await redis.get(CONTEXT_KEY);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

/**
 * Save the full structured context to Redis
 * @param {Object} context - The context object to save
 */
async function saveContext(context) {
  context.meta = {
    lastUpdated: new Date().toISOString(),
    version: (context.meta?.version || 0) + 1
  };
  await redis.set(CONTEXT_KEY, JSON.stringify(context));
}

/**
 * Render context as text for the LLM prompt
 * @param {Object} options - { maxEvents: 15, minImportance: 'low' }
 * @returns {string} Formatted context text for Claude prompt
 */
async function renderContextForLLM(options = {}) {
  const { maxEvents = 15, minImportance = 'low' } = options;
  const context = await getContext();
  if (!context) return '';

  const importanceOrder = { high: 3, medium: 2, low: 1 };
  const minLevel = importanceOrder[minImportance] || 1;

  let output = '';

  // About section
  if (context.about) {
    output += `**Kontext über Fläsch:**\n${context.about.content}\n\n`;
  }

  // Characters
  if (context.characters && context.characters.items) {
    output += '**Wiederkehrende Charaktere (bereits etabliert):**\n';
    for (const char of context.characters.items) {
      output += `- **${char.name}:**\n`;
      for (const detail of char.details) {
        output += `  * ${detail}\n`;
      }
    }
    output += '\n';
  }

  // Schaerfe-Skala
  if (context.schaerfe_skala) {
    output += `**${context.schaerfe_skala.title}:**\n${context.schaerfe_skala.content}\n\n`;
  }

  // Events - filtered by importance and limited
  if (context.events && context.events.items) {
    const filtered = context.events.items
      .filter(e => (importanceOrder[e.importance] || 1) >= minLevel)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, maxEvents);

    if (filtered.length > 0) {
      output += '**Bisherige Ereignisse (Storylines zum Anknüpfen):**\n\n';
      for (const evt of filtered) {
        output += `*${evt.title} (${evt.date}):* ${evt.summary}\n\n`;
      }
    }
  }

  // Running Gags
  if (context.running_gags && context.running_gags.items) {
    output += '**Running Gags:**\n';
    for (const gag of context.running_gags.items) {
      output += `- ${gag}\n`;
    }
    output += '\n';
  }

  // Style Guidelines
  if (context.style_guidelines) {
    output += `**Stil-Richtlinien:**\n${context.style_guidelines.content}\n\n`;
  }

  // Locations
  if (context.locations && context.locations.items) {
    output += '**Wichtige Orte:**\n';
    for (const loc of context.locations.items) {
      output += `- ${loc}\n`;
    }
    output += '\n';
  }

  return output.trim();
}

/**
 * Add a new event from a published article
 * @param {string} title - Article title
 * @param {string} category - Article category
 * @param {string} extractedText - Claude-extracted context summary
 */
async function addEventFromArticle(title, category, extractedText) {
  const context = await getContext();
  if (!context) throw new Error('No context data in Redis. Run migration first.');

  if (!context.events) {
    context.events = { title: 'Bisherige Ereignisse', items: [] };
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const id = `evt_${Date.now()}`;

  context.events.items.push({
    id,
    date: dateStr,
    title,
    category,
    summary: extractedText,
    importance: 'medium'
  });

  await saveContext(context);
  return id;
}

/**
 * Migrate from the existing flaesch-kontext.md into structured Redis data
 * @param {string} markdownContent - The full markdown file content
 * @returns {Object} The migrated context object
 */
function migrateFromMarkdown(markdownContent) {
  const context = {
    meta: { lastUpdated: new Date().toISOString(), version: 1 },
    about: {
      title: 'Über Fläsch',
      content: '- Kleines Dorf in Graubünden, bekannt für Weinbau und als "Chili-Dorf"\n- Motto: "Fläsch steht auf MEDIUM" (nicht zu mild, nicht zu scharf)\n- Im Dorf gibt es einen **Volg** (Dorfladen/Supermarkt)\n- Spitzname aus Chur: "die Gallier Graubündens"\n- Ca. 900 Einwohner'
    },
    characters: {
      title: 'Wiederkehrende Charaktere',
      items: []
    },
    schaerfe_skala: {
      title: 'Die Fläscher Schärfe-Skala',
      content: ''
    },
    events: {
      title: 'Bisherige Ereignisse',
      items: []
    },
    running_gags: {
      title: 'Running Gags',
      items: []
    },
    style_guidelines: {
      title: 'Stil-Richtlinien',
      content: ''
    },
    categories: {
      title: 'Kategorien',
      content: ''
    },
    locations: {
      title: 'Wichtige Orte',
      items: []
    }
  };

  const lines = markdownContent.split('\n');

  // Parse characters section
  const characterDefs = [
    {
      id: 'ceo',
      name: 'Der CEO (Gemeindepräsident)',
      details: [
        'Leitet gerne Arbeitsgruppen, setzt aber eigene Meinung durch',
        'Nutzt oft "Vertrauen" in Reden',
        'Hat Steuererhöhung 70%→75% vorgeschlagen (42:21 abgelehnt)',
        'Plant gerne übertriebene Feierlichkeiten'
      ]
    },
    {
      id: 'diablo',
      name: 'El Diablo Müller (Chili-Diabolo Müller)',
      details: [
        'Dorfbewohner mit starken Meinungen, meldet sich regelmässig',
        'Schreibt kritische Leserbriefe, nostalgisch',
        'Zitat: "Früher sind wir einfach in den Wald gegangen"',
        'Möglicher Nachfolgekandidat für GPK'
      ]
    },
    {
      id: 'adjutant',
      name: 'Der Adjutant (Abwart)',
      details: [
        'Mysteriöse Figur mit undefinierten Kompetenzen',
        'Unterstützt verschiedene Projekte',
        'Sorgt für Ordnung'
      ]
    },
    {
      id: 'tamara',
      name: 'Tamara W.',
      details: ['Wirtschaftsprüferin bei LGT, rechnet Kosten vor']
    },
    {
      id: 'margrit',
      name: 'Margrit',
      details: ['Stammkundin des Volg, kommentiert politische Ereignisse']
    },
    {
      id: 'hansruedi',
      name: 'Hansruedi',
      details: ['Besitzt Rebberg, kritisch gegenüber Baukosten']
    },
    {
      id: 'nicole',
      name: 'Nicole Felix',
      details: ['Neues GPK-Mitglied (ab 1. März 2026)']
    }
  ];
  context.characters.items = characterDefs;

  // Schaerfe-Skala
  context.schaerfe_skala.content = [
    '🌶️ Mild - akzeptabel',
    '🌶️🌶️ Medium - genau richtig (Goldilocks-Zone)',
    '🌶️🌶️🌶️ Hot - grenzwertig',
    '🌶️🌶️🌶️🌶️ Extra Hot (Twin Peaks) - zu scharf, abgelehnt',
    '🌶️🌶️🌶️🌶️🌶️ Inferno - völlig verrückt',
    '',
    '**Erkenntnis:** Fläsch steht auf MEDIUM - nicht mild, nicht extra hot!'
  ].join('\n');

  // Running Gags
  context.running_gags.items = [
    'CEO und seine Arbeitsgruppen',
    'Die "Fläscher Schärfe-Skala"',
    'Goldenes WC im Kirchturm',
    'Fläsch als "Gallier Graubündens"',
    'Überdimensionierte Projekte für kleines Dorf',
    'Realitätsferne Analysen vs. Bürgererfahrung'
  ];

  // Style Guidelines
  context.style_guidelines.content = [
    '- Satirisch: Wie "Der Postillon" - übertrieben aber glaubwürdig',
    '- Absurd: Surreal und ironisch',
    '- Ironisch: Subtile Kritik und Doppeldeutigkeiten',
    '- Ernst-satirisch: Ernst beginnend, dann satirisch',
    '',
    'Regeln:',
    '- Keine vollen Namen - nur Vornamen oder Initialen (z.B. René P.)',
    '- Schweizer Hochdeutsch - keine ß, Guillemets «» statt ""',
    '- Keine Beleidigungen - satirisch, nicht böswillig',
    '- Dorf-typische Themen: Gemeindepolitik, lokale Projekte, Dorfklatsch',
    '- Zitate von (fiktiven) Dorfbewohnern',
    '- Gemeindeversammlungen, Abstimmungen, Arbeitsgruppen'
  ].join('\n');

  // Categories
  context.categories.content = [
    '- Politik: Gemeindepolitik, Abstimmungen, Gemeinderat',
    '- Wirtschaft: Lokale Geschäfte, Marketing-Fails, Investitionen',
    '- Kurioses: Skurrile Ereignisse, absurde Situationen',
    '- Kultur: Veranstaltungen, Traditionen',
    '- Sport: Sportvereine, lokale Events',
    '- Kirche: Kirchgemeinde, Pfarrer, religiöse Themen',
    '- Gesellschaft: Soziale Themen, Dorfgemeinschaft'
  ].join('\n');

  // Locations
  context.locations.items = [
    'Volg - Dorfladen und sozialer Treffpunkt',
    'Mehrzweckgebäude - Ort der Gemeindeversammlungen',
    'Kirchturm - Standort des Goldenen WCs',
    'Waffenplatz St. Luzisteig - Militärisches Testgelände',
    'Fläscherberg - Lokaler Berg',
    'Falknistal - Tal mit Dinosaurier-Funden',
    'Pfarrbüro - Zu klein für den neuen Pfarrer'
  ];

  // Parse events from markdown - look for ### headers with dates
  const eventRegex = /^### (?:(\w+ \d{4}):?\s*)?(.+)/;
  let currentEvent = null;
  let currentSummary = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(eventRegex);

    if (match && i > 60) { // Skip character section headers
      // Save previous event
      if (currentEvent) {
        currentEvent.summary = currentSummary.join(' ').trim();
        if (currentEvent.summary) {
          context.events.items.push(currentEvent);
        }
      }

      const dateStr = match[1] || '';
      const title = match[2].trim();

      // Convert "November 2025" to "2025-11"
      const monthMap = {
        'Januar': '01', 'Februar': '02', 'März': '03', 'April': '04',
        'Mai': '05', 'Juni': '06', 'Juli': '07', 'August': '08',
        'September': '09', 'Oktober': '10', 'November': '11', 'Dezember': '12'
      };
      let isoDate = '';
      const dateMatch = dateStr.match(/(\w+)\s+(\d{4})/);
      if (dateMatch) {
        const month = monthMap[dateMatch[1]] || '01';
        isoDate = `${dateMatch[2]}-${month}`;
      }

      currentEvent = {
        id: `evt_${Date.now()}_${i}`,
        date: isoDate || '2025-11',
        title: title.replace(/\s*\(.*?\)\s*$/, '').trim(),
        category: '',
        summary: '',
        importance: 'medium'
      };
      currentSummary = [];
    } else if (currentEvent && line.trim()) {
      // Collect summary lines (skip markdown formatting noise)
      const cleaned = line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim();
      if (cleaned && !cleaned.startsWith('#') && !cleaned.startsWith('---') && !cleaned.startsWith('## ')) {
        // Skip auto-generated noise
        if (!cleaned.includes('Ich kann den bereitgestellten Link nicht') &&
            !cleaned.includes('Keine spezifischen Personen') &&
            cleaned.length > 5) {
          currentSummary.push(cleaned);
        }
      }
    }

    // Stop at Stil-Richtlinien section
    if (line.startsWith('## Stil-Richtlinien')) {
      if (currentEvent) {
        currentEvent.summary = currentSummary.join(' ').trim();
        if (currentEvent.summary) {
          context.events.items.push(currentEvent);
        }
      }
      currentEvent = null;
      break;
    }
  }

  // Mark key events as high importance
  const highImportanceKeywords = ['Steuer', 'Gemeindeversammlung', 'GPK', 'Dinosaurier', 'Chili\'s Restaurant'];
  for (const evt of context.events.items) {
    if (highImportanceKeywords.some(kw => evt.title.includes(kw) || evt.summary.includes(kw))) {
      evt.importance = 'high';
    }
    // Auto-generated verbose entries → low importance
    if (evt.summary.length > 500) {
      evt.importance = 'low';
    }
  }

  return context;
}

module.exports = {
  getContext,
  saveContext,
  renderContextForLLM,
  addEventFromArticle,
  migrateFromMarkdown
};
