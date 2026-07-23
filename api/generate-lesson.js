// api/generate-lesson.js
// Vercel Serverless Function. Same logic as the old Express route in
// server.js, just in Vercel's (req, res) handler shape. Vercel's Node
// runtime has global fetch built in, so node-fetch/express are not needed.
// GEMINI_API_KEY must be set in Vercel Project Settings -> Environment
// Variables, not in a committed .env file.

const API_KEY = process.env.GEMINI_API_KEY;
// Flash-Lite handles structured JSON well and is less capacity-starved than
// the newest flagship Flash models. Override with GEMINI_MODEL if needed.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
// Keep the fallback list short — each attempt can take several seconds and
// Vercel will kill the function (returning plain text, not JSON) if we exceed
// maxDuration while trying too many models.
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash-lite')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const LESSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    warmUp: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        sampleAnswer: { type: 'string' },
      },
      required: ['question', 'sampleAnswer'],
    },
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          emoji: { type: 'string' },
          sentence: { type: 'string' },
        },
        required: ['word', 'emoji', 'sentence'],
      },
    },
    sentenceFrames: { type: 'array', items: { type: 'string' } },
    speakingQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          sampleAnswer: { type: 'string' },
        },
        required: ['question', 'sampleAnswer'],
      },
    },
    activity: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        prompt: { type: 'string' },
        templates: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'prompt', 'templates'],
    },
    reviewSentences: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'warmUp', 'vocabulary', 'sentenceFrames', 'speakingQuestions', 'activity', 'reviewSentences'],
};

function modelCandidates() {
  return [...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS])].slice(0, 2);
}

function isCapacityError(status, message) {
  const msg = String(message || '').toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    msg.includes('high demand') ||
    msg.includes('try again later') ||
    msg.includes('resource exhausted') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded')
  );
}

async function generateWithModel(model, prompt) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: LESSON_SCHEMA,
        },
      }),
    }
  );

  const raw = await resp.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: { message: raw.slice(0, 300) || `Non-JSON response from Gemini (${resp.status})` } };
  }
  return { resp, data };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel Project Settings -> Environment Variables, then redeploy.' });
  }

  const { topic, level, focus, duration } = req.body || {};
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Missing "topic" in request body.' });
  }

  const safeLevel = ['Beginner', 'Intermediate', 'Advanced'].includes(level) ? level : 'Intermediate';
  const safeDuration = ['15', '25', '40'].includes(String(duration)) ? String(duration) : '25';
  const focusLine = focus ? `\nSpecific focus: ${focus}.` : '';

  const counts = {
    15: { vocab: 4, questions: 3 },
    25: { vocab: 6, questions: 4 },
    40: { vocab: 8, questions: 5 },
  }[safeDuration];

  const prompt = `You are an expert ESL curriculum designer. Generate a ${safeDuration}-minute structured lesson about "${topic}" for ${safeLevel} level English learners.${focusLine}

Generate exactly: ${counts.vocab} vocabulary items, 4 sentenceFrames, ${counts.questions} speakingQuestions, 4 activity templates, 3 reviewSentences. All content appropriate for ${safeLevel} ESL learners. Sentence frames and activity templates should contain a literal "___" blank.`;

  try {
    const models = modelCandidates();
    let lastError = null;

    for (const model of models) {
      const { resp, data } = await generateWithModel(model, prompt);
      if (!resp.ok) {
        const message = data?.error?.message || `Gemini API error (${resp.status})`;
        lastError = { status: resp.status, message };
        if (isCapacityError(resp.status, message) && model !== models[models.length - 1]) {
          console.warn(`Model ${model} busy (${resp.status}); trying fallback…`);
          continue;
        }
        return res.status(resp.status).json({ error: message });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const blockReason = data.promptFeedback?.blockReason;
        return res.status(502).json({ error: blockReason ? `Blocked by Gemini: ${blockReason}` : 'Empty response from model.' });
      }

      let lesson;
      try {
        lesson = JSON.parse(text);
      } catch (e) {
        return res.status(502).json({ error: 'Model did not return valid JSON.' });
      }

      return res.status(200).json({ lesson, level: safeLevel, duration: safeDuration });
    }

    return res.status(lastError?.status || 503).json({
      error: lastError?.message || 'All Gemini models are currently unavailable. Try again shortly.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reach Gemini API. Check function logs.' });
  }
};
