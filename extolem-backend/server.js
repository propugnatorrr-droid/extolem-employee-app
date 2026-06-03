require('dotenv').config();
process.on('uncaughtException', (err) => console.error('Uncaught:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err?.message || err));
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

      suggestReply(messageText, history).then(result => {
        db.prepare('UPDATE messages SET ai_suggestion = ? WHERE instagram_message_id = ?')
          .run(result.raw, messageId);
      }).catch(console.error);
    }
  }
});

// ─── GET ALL CONVERSATIONS ────────────────────────────────────────────────────
app.get('/conversations', requireAuth, (req, res) => {
  const convos = db.prepare(`
    SELECT c.*,
      (SELECT text FROM messages WHERE thread_id = c.instagram_thread_id ORDER BY timestamp DESC, id DESC LIMIT 1) as last_message,
      (SELECT timestamp FROM messages WHERE thread_id = c.instagram_thread_id ORDER BY timestamp DESC, id DESC LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM messages m
         WHERE m.thread_id = c.instagram_thread_id AND m.sender = 'client'
           AND m.timestamp > COALESCE(
             (SELECT MAX(timestamp) FROM messages WHERE thread_id = c.instagram_thread_id AND sender = 'extolem'), '0'
           )
      ) as unread_count
    FROM conversations c
    WHERE EXISTS (SELECT 1 FROM messages WHERE thread_id = c.instagram_thread_id)
    ORDER BY last_message_time DESC
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

// ─── SEND REPLY BACK TO INSTAGRAM DM ─────────────────────────────────────────
app.post('/conversations/:threadId/send', requireAuth, async (req, res) => {
  const { text } = req.body;
  const { threadId } = req.params;
  if (!text) return res.status(400).json({ error: 'text required' });

  // Get the Instagram sender ID from thread (format: ig_<senderId>)
  const convo = db.prepare('SELECT * FROM conversations WHERE instagram_thread_id = ?').get(threadId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  const isInstagramThread = threadId.startsWith('ig_');

  if (isInstagramThread && process.env.INSTAGRAM_ACCESS_TOKEN) {
    const recipientId = convo.client_username; // stored as sender ID
    try {
      const fetch = require('node-fetch');
      const igRes = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
          access_token: process.env.INSTAGRAM_ACCESS_TOKEN
        })
      });
      const igData = await igRes.json();
      if (igData.error) {
        console.error('Instagram send error:', igData.error);
        return res.status(500).json({ error: igData.error.message });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Failed to send via Instagram' });
    }
  }

  // Store our reply in DB regardless
  db.prepare('INSERT INTO messages (thread_id, instagram_message_id, sender, text, replied) VALUES (?, ?, "extolem", ?, 1)')
    .run(threadId, `reply_${Date.now()}`, text);

  // Mark all client messages as replied
  db.prepare('UPDATE messages SET replied = 1 WHERE thread_id = ? AND sender = "client"').run(threadId);
  db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE instagram_thread_id = ?').run(threadId);

  res.json({ ok: true });
});

// ─── GET INSTAGRAM USER INFO (resolve name from sender ID) ───────────────────
app.get('/instagram/user/:userId', requireAuth, async (req, res) => {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) return res.json({ name: 'Instagram User' });
  try {
    const fetch = require('node-fetch');
    const r = await fetch(`https://graph.instagram.com/v21.0/${req.params.userId}?fields=name,username&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.json({ name: 'Instagram User' });
  }
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
    const result = await suggestReply(messageText, history);
    res.json({
      suggestion: result.suggestion,
      emotion: result.emotion,
      intent: result.intent,
      business: result.business,
      strategy: result.strategy,
      nextMove: result.nextMove,
    });
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

  const result = await suggestReply(messageText, []);
  res.json({ threadId, suggestion: result.suggestion, emotion: result.emotion, intent: result.intent, business: result.business, strategy: result.strategy, nextMove: result.nextMove });
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

const { suggestReply: genSuggestReply } = require('./deepseek');

// Insert one message + upsert its conversation. Returns true if it was NEW.
function ingestOneMessage({ threadId, messageId, senderUsername, senderName, text, sender, timestamp }) {
  if (!threadId || !text || !messageId) return false;
  const who = sender === 'extolem' ? 'extolem' : 'client';

  // Upsert conversation (only update name from real client messages)
  db.prepare(`
    INSERT INTO conversations (instagram_thread_id, client_username, client_name)
    VALUES (?, ?, ?)
    ON CONFLICT(instagram_thread_id) DO UPDATE SET
      updated_at = CURRENT_TIMESTAMP,
      client_username = COALESCE(NULLIF(excluded.client_username,''), conversations.client_username),
      client_name = COALESCE(NULLIF(excluded.client_name,''), conversations.client_name)
  `).run(threadId, senderUsername || '', senderName || '');

  // Skip if we already have this message
  const existing = db.prepare('SELECT id FROM messages WHERE instagram_message_id = ?').get(messageId);
  if (existing) return false;

  // Insert with original timestamp if provided (keeps correct ordering)
  if (timestamp) {
    db.prepare('INSERT OR IGNORE INTO messages (thread_id, instagram_message_id, sender, text, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(threadId, messageId, who, text, timestamp);
  } else {
    db.prepare('INSERT OR IGNORE INTO messages (thread_id, instagram_message_id, sender, text) VALUES (?, ?, ?, ?)')
      .run(threadId, messageId, who, text);
  }
  return true;
}

// Generate an AI suggestion for a brand-new client message (async, best-effort)
function queueAISuggestion(threadId, messageId, text) {
  const history = db.prepare(
    'SELECT sender, text FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT 10'
  ).all(threadId).reverse();
  genSuggestReply(text, history).then(result => {
    db.prepare('UPDATE messages SET ai_suggestion = ? WHERE instagram_message_id = ?').run(result.raw, messageId);
  }).catch(e => console.error('AI suggestion failed:', e.message));
}

// ─── POLLER INGEST — single message (legacy) ─────────────────────────────────
app.post('/poller/message', requireAuth, (req, res) => {
  try {
    const isNew = ingestOneMessage({ ...req.body, sender: 'client' });
    if (isNew && req.body.messageId) queueAISuggestion(req.body.threadId, req.body.messageId, req.body.text);
    res.json({ ok: true, new: isNew });
  } catch (e) {
    console.error('poller/message error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── POLLER INGEST — batch sync (primary) ────────────────────────────────────
// Accepts { messages: [{threadId, messageId, senderUsername, senderName, text, sender, timestamp}] }
// Dedupes by messageId, only generates AI for genuinely new client messages.
// This is idempotent — safe to resend the same messages every poll.
app.post('/poller/sync', requireAuth, (req, res) => {
  const list = Array.isArray(req.body.messages) ? req.body.messages : [];
  let newCount = 0;
  const toSuggest = [];

  const tx = db.transaction((items) => {
    for (const m of items) {
      try {
        const isNew = ingestOneMessage(m);
        if (isNew) {
          newCount++;
          // Only auto-suggest for client messages that have no reply after them
          if ((m.sender || 'client') === 'client') {
            toSuggest.push({ threadId: m.threadId, messageId: m.messageId, text: m.text });
          }
        }
      } catch (e) {
        console.error('ingest error:', e.message);
      }
    }
  });
  tx(list);

  // Respond immediately, then generate AI suggestions in the background.
  res.json({ ok: true, received: list.length, new: newCount });

  // Only generate suggestions for the most recent few to avoid burst cost.
  toSuggest.slice(-5).forEach(s => queueAISuggestion(s.threadId, s.messageId, s.text));
  if (newCount > 0) console.log(`✅ Synced ${newCount} new message(s) from ${list.length} received`);
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Extolem AI Backend' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Extolem backend running on port ${PORT}`));
