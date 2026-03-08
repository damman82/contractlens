# ContractLens 🔍

AI-powered contract risk analyzer. Upload any contract, get a plain-English risk report in seconds.

## Deploy to Vercel (free, ~5 minutes)

### 1. Get the code on GitHub

1. Go to [github.com](https://github.com) → **New repository** → name it `contractlens` → **Create**
2. Download this project folder as a ZIP, unzip it
3. Open Terminal in the unzipped folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/contractlens.git
   git push -u origin main
   ```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign up free** (use your GitHub account)
2. Click **Add New Project** → Import your `contractlens` repo
3. Vercel will auto-detect the Vite framework — leave all settings as default
4. Click **Deploy** — it'll build and give you a live URL in ~60 seconds

### 3. Add your Anthropic API key (IMPORTANT)

1. In your Vercel project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from [console.anthropic.com](https://console.anthropic.com)
   - **Environment:** Production, Preview, Development ✓
3. Go to **Deployments** → click the three dots on your latest deployment → **Redeploy**

Your app is now live with the API key safely server-side. ✅

---

## Local development

```bash
npm install
npm run dev
```

For local API routes to work, install Vercel CLI:
```bash
npm i -g vercel
vercel dev
```

This starts both the Vite dev server and the serverless functions together.

---

## Project structure

```
contractlens/
├── api/
│   ├── analyze.js     # Contract analysis endpoint (keeps API key secret)
│   └── chat.js        # Contract chat endpoint
├── src/
│   ├── App.jsx        # Full React frontend
│   └── main.jsx       # Entry point
├── index.html
├── package.json
├── vercel.json        # Serverless function config (60s timeout for analysis)
└── vite.config.js
```

## Connecting email capture

In `src/App.jsx`, find the `EmailModal` component and the line:
```js
console.log("Email captured:", email);
```

Replace with a POST to your email tool. Recommended free options:
- **[Loops.so](https://loops.so)** — built for SaaS, generous free tier
- **[Resend](https://resend.com)** — simple API, free up to 3000/month
- **[Mailchimp](https://mailchimp.com)** — free up to 500 contacts

Example with Resend (add `RESEND_API_KEY` to Vercel env vars, create `api/subscribe.js`):
```js
// api/subscribe.js
export default async function handler(req, res) {
  const { email } = req.body;
  await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, audience_id: 'YOUR_AUDIENCE_ID' })
  });
  res.status(200).json({ ok: true });
}
```

## Rate limits

The API routes include basic in-memory rate limiting:
- **Analysis:** 10 requests per IP per hour
- **Chat:** 50 messages per IP per hour

For production, replace with Redis-based rate limiting (Upstash is free and integrates with Vercel).
