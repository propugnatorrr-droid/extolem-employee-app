# Extolem Employee App — Full Setup Guide

## What You Built
- **Android APK** — React Native app for your employees
- **Backend** — Node.js server that handles Instagram DMs + DeepSeek AI
- **3 screens**: Messages (inbox + threads), AI Assistant (chat), Knowledge Base (edit what AI knows)

---

## STEP 1 — Deploy the Backend (15 mins)

### Option A: Railway (Recommended — free tier available)
1. Go to railway.app → New Project → Deploy from GitHub
2. Upload the `extolem-backend` folder
3. Add these environment variables in Railway dashboard:
   ```
   DEEPSEEK_API_KEY=your_key_from_platform.deepseek.com
   INSTAGRAM_VERIFY_TOKEN=extolem_webhook_secret_2024
   INSTAGRAM_ACCESS_TOKEN=  (fill after Step 2)
   INSTAGRAM_ACCOUNT_ID=    (fill after Step 2)
   APP_SECRET=make_up_a_strong_password_here
   PORT=3001
   ```
4. Railway gives you a URL like `https://extolem-backend.up.railway.app` → copy this

### Option B: Render.com (also free)
Same process — New Web Service → connect repo → add env vars

---

## STEP 2 — Instagram DMs Setup (20 mins)

### 2a. Make @extolem a Business Account
- Instagram app → Settings → Account → Switch to Professional Account → Business

### 2b. Create Meta Developer App
1. Go to developers.facebook.com → My Apps → Create App
2. Select "Business" type
3. Add product: **Messenger** (this covers Instagram DMs)

### 2c. Connect Instagram
1. In your Meta app → Messenger → Settings
2. Under "Instagram accounts" → Add your @extolem account
3. Copy the **Access Token** → paste into your Railway `INSTAGRAM_ACCESS_TOKEN`
4. Copy the **Instagram Account ID** → paste into `INSTAGRAM_ACCOUNT_ID`

### 2d. Set Up Webhook
1. In Meta app → Webhooks → Add Callback URL:
   ```
   https://YOUR_RAILWAY_URL.up.railway.app/webhook/instagram
   ```
2. Verify token: `extolem_webhook_secret_2024`
3. Subscribe to: **messages**

✅ Done — Instagram DMs now flow into your backend automatically.

> **Note:** In Meta development mode, this only works for your own account and test users.
> For full production use, submit for Meta app review (takes 1-4 weeks). Your employees can still use the manual paste workflow in the meantime.

---

## STEP 3 — Build the APK (10 mins)

### Prerequisites
- Node.js installed: nodejs.org
- Expo account: expo.dev (free)

### Commands
```bash
cd extolem-app
npm install

# Update your backend URL in src/config.js first!
# API_BASE_URL = 'https://YOUR_RAILWAY_URL.up.railway.app'
# APP_TOKEN = 'same value as APP_SECRET in Railway'

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build the APK (takes ~5 mins, builds in cloud — no Android Studio needed)
eas build --platform android --profile preview
```

EAS gives you a download link for the `.apk` file. Send it to your employee → they install it on Android.

---

## How Employees Use the App

### Inbox (Messages tab)
- All Instagram DMs appear here automatically (live, polls every 15s)
- Blue badge = unread client messages
- Tap a conversation → see full thread

### Inside a Thread
- **"Suggest Reply" button** → AI reads the latest DM and generates a perfect reply
- **Copy to Clipboard** → paste it directly in Instagram
- **Ask AI anything** → type "how should I handle this objection?" or "translate this to a polite follow-up"
- **Mark Replied** → clears unread badge

### New Message (+ button in Inbox)
- Employee pastes any message from anywhere (Instagram, WhatsApp, email)
- Gets instant AI reply suggestion

### AI Assistant tab
- General Q&A: "What do we charge for AI receptionists?" / "What industries do we target?"
- Quick prompts built in for common questions
- Long press any message to copy it

### Knowledge Base tab
- Edit what the AI knows about Extolem at any time
- Add new categories (e.g. "new_service", "promotion_2025")
- Changes take effect immediately

---

## DeepSeek API Key
Get yours at: platform.deepseek.com → API Keys → Create
Cost: ~$0.001 per reply suggestion (extremely cheap)

---

## Files Overview
```
extolem-backend/
  server.js        — Express API + webhook handler
  deepseek.js      — AI integration + system prompt
  db.js            — SQLite database + knowledge base seed
  .env.example     — copy to .env and fill in

extolem-app/
  App.js           — Navigation setup
  src/
    config.js      — Backend URL + auth token (update this!)
    api.js         — API calls
    theme.js       — Extolem colors + typography
    screens/
      InboxScreen.js          — Conversation list
      ThreadScreen.js         — Message thread + AI suggestions
      AIAssistantScreen.js    — General AI chat
      NewConversationScreen.js — Paste message → get reply
      KnowledgeScreen.js      — Edit AI knowledge
```
