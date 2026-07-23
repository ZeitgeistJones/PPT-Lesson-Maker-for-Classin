# ClassIn Lesson Builder (PDF)

Type a topic → get a downloadable `.pdf` with slide-style pages built for ESL
lessons on ClassIn.

## How it works

Each page of the PDF is designed like a presentation slide — coloured
backgrounds, cards, large readable text. The teacher opens the PDF in ClassIn's
document viewer and advances pages to pace the lesson. No hyperlinks, no macros,
no compatibility concerns — just a clean document that works everywhere.

### Lesson structure (one page per section)

1. **Title** — lesson name, level, duration
2. **Warm-Up** — question + sample answer
3. **New Words** — vocabulary cards (words only)
4. **New Words — In Sentences** — words + example sentences
5. **Sentence Frames** — fill-in-the-blank patterns
6. **Story (2 pages)** — illustrated reading passage with scene visuals
7. **Reading Comprehension** — 3 questions + sample answers
8. **Your Ideas!** — 2 open-ended creative questions about the story
9. **Let's Talk!** — one page per speaking question + sample answer
10. **Your Turn!** — guided activity with templates
11. **Great Job!** — review sentences

## Project structure

```
public/                     <- served statically
  index.html
  lib/buildLessonPdf.js     <- builds the PDF in-browser with jsPDF
api/
  generate-lesson.js        <- Vercel Serverless Function: POST /api/generate-lesson
server.js                   <- Express server, LOCAL DEV ONLY (npm start)
vercel.json
package.json
.env.example
```

The app has two possible "backends" for the same `/api/generate-lesson`
route, so it works the same way in both places:
- **Locally:** `server.js` (Express) serves it.
- **On Vercel:** `api/generate-lesson.js` serves it as a Serverless Function,
  and Vercel serves everything in `public/` as static files automatically —
  no build step needed.

## Deploy to Vercel

1. Push this project to a GitHub repo (or use the Vercel CLI directly).
2. In the [Vercel dashboard](https://vercel.com/new), import the repo.
   Framework preset: **Other** (no build command / output directory needed —
   leave those blank).
3. Add environment variables in **Project Settings → Environment Variables**:
   - `GEMINI_API_KEY` — your key from https://aistudio.google.com/apikey
   - `GEMINI_MODEL` — optional, defaults to `gemini-3.1-flash-lite`
   - `GEMINI_FALLBACK_MODELS` — optional (defaults to `gemini-3.5-flash-lite`)
4. Deploy (env var changes require a redeploy).

Or via CLI:

```bash
npm i -g vercel
vercel link
vercel env add GEMINI_API_KEY
vercel --prod
```

## Local development (optional)

```bash
npm install
cp .env.example .env
# edit .env and paste your Gemini API key
npm start
```

Then open http://localhost:3000.

## Notes

- Default model is `gemini-3.1-flash-lite`, set via `GEMINI_MODEL`. If a
  model is capacity-throttled, the API automatically tries one fallback from
  `GEMINI_FALLBACK_MODELS`.
- Uses `jsPDF 2.5.2` (self-hosted at `public/lib/jspdf.umd.min.js`) — no
  build step and no external CDN required for the frontend.
- Emoji from the Gemini response are stripped in the PDF (jsPDF's built-in
  helvetica font doesn't render them), but the lesson content is unchanged.
