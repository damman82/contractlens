export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { messages, systemPrompt } = req.body;
  if (!messages || !systemPrompt) return res.status(400).json({ error: 'Missing messages or systemPrompt' });

  // Rate limit
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  if (!global._chatRateLimit) global._chatRateLimit = {};
  const rl = global._chatRateLimit;
  if (!rl[ip]) rl[ip] = { count: 0, windowStart: now };
  if (now - rl[ip].windowStart > 60 * 60 * 1000) { rl[ip] = { count: 0, windowStart: now }; }
  rl[ip].count++;
  if (rl[ip].count > 50) {
    return res.status(429).json({ error: 'Too many chat messages. Please wait before continuing.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const reply = data.content.map(c => c.text || '').join('');
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Chat failed' });
  }
}
