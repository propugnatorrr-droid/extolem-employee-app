require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./db');
const { generateReply, suggestReply } = require('./deepseek');

const app = express();
app.use(cors());
app.use(express.json());

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers['x-app-token'];
  if (token !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── INSTAGRAM WEBHOOK VERIFICATION ──────────────────────────────────────────
app.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    console.log('✅ Instagram webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ─── INSTAGRAM WEBHOOK — RECEIVE DMs ─────────────────────────────────────────
app.post('/webhook/instagram', async (req, res) => {
  res.sendStatus(200); // always respond fast to Meta

  const body = req.body;
  if (body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const messageText = event.message.text;
      const messageId = event.message.mid;
      const threadId = `ig_${senderId}`;

      // upsert conversation
      db.prepare(`
        INSERT INTO conversations (instagram_thread_id, client_username, client_name)
        VALUES (?, ?, ?)
        ON CONFLICT(instagram_thread_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      `).run(threadId, senderId, `Instagram User`);

      // store message
      try {
        db.prepare(`
          INSERT OR IGNORE INTO messages (thread_id, instagram_message_id, sender, text)
          VALUES (?, ?, 'client', ?)
        `).run(threadId, messageId, messageText);
      } catch (e) { /* duplicate */ }

      // auto-generate AI suggestion in background
      const history = db.prepare(
        'SELECT sender, text FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT 10'
      ).all(threadId).reverse();

      suggestReply(messageText, history).then(suggestion => {
        db.prepare('UPDATE messages SET ai_suggestion = ? WHERE instagram_message_id = ?')
          .run(suggestion, messageId);
      }).catch(console.error);
    }
  }
});

// ─── GET ALL CONVERSATIONS ────────────────────────────────────────────────────
app.get('/conversations', requireAuth, (req, res) => {
  const convos = db.prepare(`
    SELECT c.*,
      (SELECT text FROM messages WHERE thread_id = c.instagram_thread_id ORDER BY timestamp DESC LIMIT 1) as last_message,
      (SELECT timestamp FROM messages WHERE thread_id = c.instagram_thread_id ORDER BY timestamp DESC LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM messages WHERE thread_id = c.instagram_thread_id AND replied = 0 AND sender = 'client') as unread_count
    FROM conversations c
    ORDER BY c.updated_at DESC
  `).all();
  res.json(convos);
});

// ─── GET MESSAGES FOR A THREAD ────────────────────────────────────────────────
app.get('/conversations/:threadId/messages', requireAuth, (req, res) => {
  const messages = db.prepare(
    'SELECT * FROM messages WHERE thread_id = ? ORDER BY timestamp ASC'
  ).all(req.params.threadId);
  res.json(messages);
});

// ─── MARK AS REPLIED ──────────────────────────────────────────────────────────
app.post('/conversations/:threadId/mark-replied', requireAuth, (req, res) => {
  db.prepare('UPDATE messages SET replied = 1 WHERE thread_id = ? AND sender = "client"')
    .run(req.params.threadId);
  res.json({ ok: true });
});

// ─── ASK AI (general employee question) ──────────────────────────────────────
app.post('/ask', requireAuth, async (req, res) => {
  const { question, threadId } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });

  let history = [];
  if (threadId) {
    history = db.prepare(
      'SELECT sender, text FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT 10'
    ).all(threadId).reverse().map(m => ({
      role: m.sender === 'client' ? 'user' : 'assistant',
      content: m.text
    }));
  }

  try {
    const answer = await generateReply(history, question);
    res.json({ answer });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// ─── SUGGEST REPLY FOR A MESSAGE ─────────────────────────────────────────────
app.post('/suggest-reply', requireAuth, async (req, res) => {
  const { messageText, threadId } = req.body;
  if (!messageText) return res.status(400).json({ error: 'messageText required' });

  const history = threadId
    ? db.prepare('SELECT sender, text FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT 10').all(threadId).reverse()
    : [];

  try {
    const suggestion = await suggestReply(messageText, history);
    res.json({ suggestion });
  } catch (e) {
    res.status(500).json({ error: 'AI request failed' });
  }
});

// ─── MANUAL MESSAGE ADD (for testing / paste-in workflow) ────────────────────
app.post('/conversations/manual', requireAuth, async (req, res) => {
  const { clientName, messageText } = req.body;
  if (!clientName || !messageText) return res.status(400).json({ error: 'clientName and messageText required' });

  const threadId = `manual_${Date.now()}`;
  db.prepare('INSERT INTO conversations (instagram_thread_id, client_username, client_name) VALUES (?, ?, ?)')
    .run(threadId, clientName.toLowerCase().replace(/\s/g, '_'), clientName);

  db.prepare('INSERT INTO messages (thread_id, instagram_message_id, sender, text) VALUES (?, ?, "client", ?)')
    .run(threadId, `msg_${Date.now()}`, messageText);

  const suggestion = await suggestReply(messageText, []);
  res.json({ threadId, suggestion });
});

// ─── UPDATE KNOWLEDGE BASE ────────────────────────────────────────────────────
app.post('/knowledge', requireAuth, (req, res) => {
  const { category, content } = req.body;
  if (!category || !content) return res.status(400).json({ error: 'category and content required' });

  db.prepare('INSERT OR REPLACE INTO knowledge_base (category, content) VALUES (?, ?)').run(category, content);
  res.json({ ok: true });
});

app.get('/knowledge', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM knowledge_base ORDER BY category').all());
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Extolem AI Backend' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Extolem backend running on port ${PORT}`));
