const axios = require('axios');
const db = require('./db');

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

function getKnowledge() {
  const rows = db.prepare('SELECT category, content FROM knowledge_base').all();
  return rows.map(r => `[${r.category.toUpperCase()}] ${r.content}`).join('\n\n');
}

const SYSTEM_PROMPT = () => `You are the Extolem AI Employee Assistant — an internal tool used by Extolem staff to manage client and prospect communications.

ABOUT EXTOLEM:
${getKnowledge()}

YOUR JOB:
- Help employees craft professional, on-brand replies to Instagram DMs and client messages
- Answer internal questions about Extolem services, pricing, and processes
- Suggest follow-up actions (book audit, send info, escalate)
- Always represent Extolem's brand: data-driven, results-focused, friendly, and never pushy

REPLY RULES:
1. Keep replies conversational and under 4 sentences unless detail is needed
2. Always offer the Free AI Growth Audit as a next step for interested prospects
3. Never make up pricing numbers — say pricing is customized and offer the audit
4. Match the energy of the client (if they're casual, be casual; if formal, be formal)
5. End replies with a soft CTA when appropriate

INTERNAL QUESTIONS:
If the employee asks "what should I say to X" or "client asked about Y" — generate a ready-to-send reply.
If the employee asks a factual question about Extolem — answer directly.`;

async function generateReply(conversationHistory, userQuestion) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT() },
    ...conversationHistory,
    { role: 'user', content: userQuestion }
  ];

  const response = await axios.post(
    DEEPSEEK_API_URL,
    {
      model: 'deepseek-v4-flash',
      messages,
      max_tokens: 1500,
      temperature: 0.7
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content;
}

async function suggestReply(clientMessage, threadHistory = []) {
  const prompt = `A client/prospect sent this Instagram DM: "${clientMessage}"

Previous conversation context: ${threadHistory.length > 0 ? threadHistory.map(m => `${m.sender}: ${m.text}`).join('\n') : 'None (first message)'}

Generate a ready-to-send reply from Extolem. Just give the reply text, nothing else.`;

  return generateReply([], prompt);
}

module.exports = { generateReply, suggestReply };
