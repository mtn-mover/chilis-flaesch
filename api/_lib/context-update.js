// Handler: UPDATE context sections in Redis
const { verifySession } = require('./auth.js');
const { getContext, saveContext } = require('./context-manager.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionToken, section, data, updateAction } = req.body;
  const session = verifySession(sessionToken);
  if (!session || session.role !== 'admin') {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }

  const VALID_SECTIONS = ['about', 'characters', 'schaerfe_skala', 'events',
    'running_gags', 'style_guidelines', 'categories', 'locations'];
  if (!section || !VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ error: 'Ungültige Section' });
  }

  try {
    const context = await getContext();
    if (!context) {
      return res.status(404).json({ error: 'Kein Kontext vorhanden. Zuerst Migration ausführen.' });
    }

    switch (updateAction) {
      case 'update-section': {
        // Update an entire section (for static content like style_guidelines)
        if (!context[section]) {
          return res.status(404).json({ error: `Section "${section}" nicht gefunden` });
        }
        if (data.content !== undefined) {
          context[section].content = data.content;
        }
        if (data.items !== undefined) {
          context[section].items = data.items;
        }
        if (data.title !== undefined) {
          context[section].title = data.title;
        }
        break;
      }

      case 'add-item': {
        // Add an item to a list section (characters, events, running_gags, locations)
        if (!context[section] || !Array.isArray(context[section].items)) {
          return res.status(400).json({ error: `Section "${section}" hat keine Items-Liste` });
        }
        const newItem = data;
        if (section === 'events' && !newItem.id) {
          newItem.id = `evt_${Date.now()}`;
        }
        if (section === 'characters' && !newItem.id) {
          newItem.id = `char_${Date.now()}`;
        }
        context[section].items.push(newItem);
        break;
      }

      case 'update-item': {
        // Update a specific item by id (for characters and events)
        if (!context[section] || !Array.isArray(context[section].items)) {
          return res.status(400).json({ error: `Section "${section}" hat keine Items-Liste` });
        }
        const idx = context[section].items.findIndex(item =>
          typeof item === 'object' ? item.id === data.id : false
        );
        if (idx === -1) {
          return res.status(404).json({ error: `Item mit ID "${data.id}" nicht gefunden` });
        }
        context[section].items[idx] = { ...context[section].items[idx], ...data };
        break;
      }

      case 'delete-item': {
        // Delete an item by id or index
        if (!context[section] || !Array.isArray(context[section].items)) {
          return res.status(400).json({ error: `Section "${section}" hat keine Items-Liste` });
        }
        if (data.id) {
          context[section].items = context[section].items.filter(item =>
            typeof item === 'object' ? item.id !== data.id : true
          );
        } else if (data.index !== undefined) {
          const idx = parseInt(data.index, 10);
          if (isNaN(idx) || idx < 0 || idx >= context[section].items.length) {
            return res.status(400).json({ error: 'Ungültiger Index' });
          }
          context[section].items.splice(idx, 1);
        }
        break;
      }

      default:
        return res.status(400).json({ error: `Unbekannte Aktion: "${updateAction}"` });
    }

    await saveContext(context);
    return res.status(200).json({ success: true, context });
  } catch (error) {
    console.error('Error updating context:', error);
    return res.status(500).json({ error: 'Fehler beim Aktualisieren des Kontexts' });
  }
};
