# ClassIn Interactive Lesson Builder

Type a topic → get a downloadable `.pptx` with clickable menu navigation,
click-to-reveal answers, and fade transitions, built for ESL lessons on ClassIn.

## What "interactive" actually means here

Real PPTX files can't do true drag-and-drop or fillable text boxes from a
browser-generated file — that requires VBA macros, which we deliberately don't
generate. What they *can* do reliably is **slide-jump hyperlinks**, and this
app uses that in two ways:

- **Menu navigation** — a hub slide with buttons that jump to any section, and
  a "🏠 Menu" button on every slide to come back.
- **Click-to-reveal** — each warm-up/vocab/speaking prompt is actually *two*
  slides (a "prompt" and an "answer"), linked by a button.
- **Transitions** — pptxgenjs has no transition API, so after it generates the
  `.pptx` we unzip it, inject a native `<p:transition>` fade on every slide's
  XML, and re-zip.

**Important caveat:** this depends on ClassIn's PPT player honoring in-file
hyperlinks and transitions when you upload a `.pptx`. Test one generated deck
in an actual ClassIn classroom before relying on it in a live lesson.

## Project structure

```
public/                     <- served statically (by Express locally, by Vercel in prod)
  index.html
  lib/buildInteractivePptx.js
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

The frontend (`public/index.html`) doesn't know or care which one is
answering; it just calls `fetch('/api/generate-lesson', ...)`.

## Deploy to Vercel

1. Push this project to a GitHub repo (or use the Vercel CLI directly from
   this folder).
2. In the [Vercel dashboard](https://vercel.com/new), import the repo.
   Framework preset: **Other** (no build command / output directory needed —
   leave those blank, Vercel auto-detects `public/` + `api/`).
3. Before or after the first deploy, go to
   **Project Settings → Environment Variables** and add:
   - `GEMINI_API_KEY` — your key from https://aistudio.google.com/apikey
   - `GEMINI_MODEL` — optional, defaults to `gemini-3.1-flash-lite`
   - `GEMINI_FALLBACK_MODELS` — optional comma-separated list (defaults to
     `gemini-3.5-flash-lite,gemini-3.5-flash`) tried automatically when the
     primary model returns high-demand / 429 / 503
4. Deploy (or redeploy, if you added the env vars after the first deploy —
   env var changes require a redeploy to take effect).

Or via CLI from this folder:

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

Then open http://localhost:3000. You can also run `vercel dev` instead, which
uses `api/generate-lesson.js` + `public/` the same way production does — pull
env vars first with `vercel env pull .env.local`.

## Extending it

- **Add a section**: add a slide-index to `planSlides()` in
  `public/lib/buildInteractivePptx.js`, build the slide(s), and add a menu
  button pointing at it.
- **Change the transition**: swap `<p:fade/>` for `<p:push dir="l"/>`,
  `<p:wipe/>`, `<p:cut/>`, etc. — standard OOXML transition elements.

## Notes

- Default model is `gemini-3.1-flash-lite`, set via `GEMINI_MODEL`. Check
  https://ai.google.dev/gemini-api/docs/models for the current lineup. If a
  model is capacity-throttled, the API automatically tries
  `GEMINI_FALLBACK_MODELS`.
- Uses `pptxgenjs@3.12.0` and `jszip@3.10.1` from cdnjs — no build step needed
  for the frontend either.
