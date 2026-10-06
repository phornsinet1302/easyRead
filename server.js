// EasyRead server: serves the page and calls Gemini. No npm dependencies (Node 18+).
const http = require('http');
const fs = require('fs');
const path = require('path');

// Minimal .env loader
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env file, that's fine */ }

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite';

const SYSTEM_PROMPT = `You help people who struggle to understand official or technical documents (refugees, rural communities, older adults, people with low literacy).
Read the document the user gives you (text and/or a photo) and respond with ONLY valid JSON, no other text, in this exact shape:
{
  "document_type": "short label, e.g. medicine label, clinic notice, school letter",
  "summary": "2-4 very short sentences in simple words, about a 5th-grade reading level. No jargon.",
  "steps": [ { "action": "one clear thing to do", "deadline": "date/time if the document gives one, otherwise empty string" } ],
  "warning": "anything dangerous or urgent (doses, deadlines, penalties) in one sentence, or empty string",
  "translated": {
    "summary": "the summary translated into the target language",
    "steps": [ { "action": "translated action", "deadline": "translated deadline or empty string" } ],
    "warning": "translated warning or empty string"
  }
}
Rules: give 2-4 steps. Never invent facts, doses or dates that are not in the document. If something is unclear or missing, say so and suggest asking a doctor, pharmacist, teacher or official office. If the target language is English, copy the English text into "translated". You are not a doctor or lawyer; for health or legal decisions, the summary should encourage checking with a professional.`;

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function simplify({ text, language, image }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server is missing GEMINI_API_KEY. Add it to a .env file.');

  const parts = [];
  if (image && image.data && image.mediaType) {
    parts.push({ inline_data: { mime_type: image.mediaType, data: image.data } });
  }
  parts.push({
    text: `Target language: ${language || 'English'}\n\nDocument text:\n${text || '(no text pasted; read the attached photo)'}`,
  });

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4000 },
  });

  // Try each model in turn. On temporary overload (503) or rate limit (429),
  // retry with growing delays, then fall back to the next model.
  const models = [MODEL, FALLBACK_MODEL].filter((m, i, a) => m && a.indexOf(m) === i);
  const RETRIES = 3;
  let r, data;
  outer: for (const model of models) {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body,
      });
      data = await r.json();
      if (r.ok) break outer;
      if (r.status !== 503 && r.status !== 429) break outer; // real error, don't retry
      if (attempt < RETRIES - 1) await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
    }
    console.warn(`Model ${model} busy (${r.status}), ${model === models[models.length - 1] ? 'giving up' : 'trying fallback'}`);
  }
  if (!r.ok) {
    if (r.status === 503 || r.status === 429) {
      throw new Error('The AI is busy right now. Please try again in a moment.');
    }
    throw new Error((data.error && data.error.message) || 'Gemini API error');
  }

  const raw = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [])
    .map((p) => p.text || '').join('');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Could not read the AI response. Please try again.');
  return JSON.parse(raw.slice(start, end + 1));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/simplify') {
      const body = JSON.parse(await readBody(req));
      if (!body.text && !body.image) return send(res, 400, { error: 'Please paste some text or add a photo.' });
      return send(res, 200, await simplify(body));
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    }
    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    send(res, 500, { error: e.message || 'Something went wrong' });
  }
});

server.listen(PORT, () => console.log(`EasyRead running at http://localhost:${PORT}`));
