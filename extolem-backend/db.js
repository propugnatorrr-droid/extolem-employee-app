const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use a persistent volume path if provided (Railway volume), else local file.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'extolem.db');
// Ensure the directory exists (e.g. /data on a mounted volume)
try { fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); } catch (e) {}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent write handling
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instagram_thread_id TEXT UNIQUE,
    client_username TEXT,
    client_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT,
    instagram_message_id TEXT UNIQUE,
    sender TEXT,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ai_suggestion TEXT,
    replied INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    content TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed Extolem knowledge base on first run
const existing = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();
if (existing.count === 0) {
  const seed = db.prepare('INSERT INTO knowledge_base (category, content) VALUES (?, ?)');
  const seedMany = db.transaction((items) => items.forEach(i => seed.run(i[0], i[1])));
  seedMany([
    ['company', 'Extolem is an AI growth systems agency based in Sunnyvale, CA and Atlanta, GA. We build AI automation, web design, and digital marketing systems for service businesses. Tagline: "We don\'t build websites. We deploy AI growth systems."'],
    ['services_ai', 'AI Services: AI Receptionist (24/7 call answering & appointment booking), AI Voice Agents, AI Chatbots, Custom AI Agents, Missed Call Recovery, CRM Automation, Review Automation, Extolem Pilot (back-office automation).'],
    ['services_marketing', 'Marketing Services: Paid advertising on Google, Meta, and YouTube. Social media marketing, Email and SMS campaigns, Conversion rate optimization, Analytics and reporting.'],
    ['services_web', 'Web & SEO Services: Website design, Landing pages, Local SEO, Technical SEO, AEO (Answer Engine Optimization), GEO (Generative Engine Optimization), Website maintenance.'],
    ['industries', 'Industries served: Healthcare (clinics, dental, plastic surgery, med spas), Legal (law firms), Real Estate, Home Services, Restaurants, Salons, B2B Companies, Local Service Businesses.'],
    ['contact', 'Contact: Email hello@extolem.com, Phone +1 (800) 559-8536, Website extolem.com, Instagram @extolem. Free 20-minute AI Growth Audit available — no obligation.'],
    ['pricing', 'Pricing is customized per business needs. We offer a free 20-minute AI Growth Audit to understand your goals and recommend the right solution. No packages are one-size-fits-all.'],
    ['cta', 'Primary call to action: Book a Free AI Growth Audit at extolem.com. The audit is 20 minutes, completely free, and shows exactly where your business is leaking leads and revenue.'],
    ['tone', 'Communication tone: data-driven, results-focused, conversational and friendly. Emphasize ROI, lead recovery, and automation benefits. Never be pushy — educate and guide. Always offer value first.'],
    ['objections', 'Common objections: Too expensive → "Pricing is customized, lets do a free audit first." Already have a website → "We don\'t just build sites, we deploy revenue systems." Not sure if AI works → "We\'ll show you exactly where you\'re losing leads in the audit."'],
    ['instagram', 'Instagram @extolem: Share AI tips, client results, behind-the-scenes content, and industry insights. DMs are handled by the Extolem team — respond within a few hours during business hours.'],
  ]);
}

module.exports = db;
