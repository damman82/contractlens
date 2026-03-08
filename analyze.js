const SYSTEM_PROMPT = `You are a senior contract attorney and risk analyst. Analyze the provided contract and return a JSON response (no markdown, no backticks, raw JSON only) in this exact structure:

{
  "summary": "2-3 sentence plain-English summary of what this contract is",
  "overallRisk": "high|medium|low",
  "riskScore": 0-100,
  "parties": ["Party 1", "Party 2"],
  "contractType": "e.g. Employment Agreement, NDA, SaaS Agreement, etc.",
  "keyDates": [{"label": "...", "value": "..."}],
  "risks": [
    {
      "id": "1",
      "severity": "high|medium|low",
      "title": "Short risk title",
      "clause": "The exact or closely paraphrased problematic clause text from the contract",
      "explanation": "Why this is risky in plain English",
      "recommendation": "What to do about it",
      "suggestedRevision": "A rewritten version of the clause that would be fairer and safer for the reader"
    }
  ],
  "positives": ["Good clause or term 1", "Good clause or term 2"],
  "missingClauses": ["Missing clause 1", "Missing clause 2"],
  "negotiationTips": ["Tip 1", "Tip 2"]
}

For each risk, make sure "suggestedRevision" is a complete, ready-to-use rewrite of the problematic clause — written in proper legal language but plain enough to understand. Be thorough. If text is unclear or not a contract, set overallRisk to "low" and explain in summary.`;

function safeParseJSON(raw) {
  try { return JSON.parse(raw); } catch (_) {}
  let s = raw.trim();
  for (const close of ['"}', '}', ']}', '"]}', '"]}}', '""}']) {
    try { return JSON.parse(s + close); } catch (_) {}
  }
  const trimmed = s.replace(/,?\s*"[^"]*"\s*:\s*[^,}\]]*$/, '');
  for (const close of [']}', '}', '""]}', '""}']) {
    try { return JSON.parse(trimmed + close); } catch (_) {}
  }
  for (let i = s.length - 1; i > s.length - 500 && i >= 0; i--) {
    const sub = s.slice(0, i + 1);
    for (const close of [']}', '}', '""]}']) {
      try { return JSON.parse(sub + close); } catch (_) {}
    }
  }
  throw new Error("Could not parse the analysis response.");
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { fileData, mediaType } = req.body;
  if (!fileData || !mediaType) return res.status(400).json({ error: 'Missing fileData or mediaType' });

  // Simple rate limiting via IP (in-memory, resets on cold start — good enough for MVP)
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  if (!global._rateLimit) global._rateLimit = {};
  const rl = global._rateLimit;
  if (!rl[ip]) rl[ip] = { count: 0, windowStart: now };
  if (now - rl[ip].windowStart > 60 * 60 * 1000) { rl[ip] = { count: 0, windowStart: now }; }
  rl[ip].count++;
  if (rl[ip].count > 10) {
    return res.status(429).json({ error: 'Too many requests. Please wait an hour before trying again.' });
  }

  const isPdf = mediaType === 'application/pdf';
  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }
    : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: fileData } };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000); // 55s timeout (Vercel limit is 60s)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: 'Analyze this contract and return the JSON risk report.' }] }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = safeParseJSON(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Analysis timed out. Your contract may be too large — try a shorter section.' });
    }
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
}
