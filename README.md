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
  slides (a "prompt" and an "answer"), linked by a button. Clicking jumps to
  the answer slide instead of toggling something on the same slide, since PPTX
  has no native click-to-show-hidden-element behavior we can script safely.
- **Transitions** — pptxgenjs (the library that builds the file) has no
  transition API, so after it generates the `.pptx` we unzip it (it's just a
  zip of XML), inject a native `<p:transition>` fade on every slide's XML, and
  re-zip. This is real PowerPoint transition metadata, not a workaround.

**Important caveat:** this all depends on ClassIn's PPT player honoring
in-file hyperlinks and transitions when you upload a `.pptx`. Some LMS/webinar
PPT viewers flatten slides to images and strip interactivity. Test one
generated deck in an actual ClassIn classroom before trusting it in a live
lesson — if ClassIn's player doesn't support clicking hyperlinked shapes,
the deck will still look right but won't be clickable, and you'd want to
fall back to manual slide-forward instead.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and paste your Gemini API key (get one at https://aistudio.google.com/apikey)
npm start
```

Then open http://localhost:3000

## How it works

- `server.js` — Express server. Holds your Gemini API key server-side and
  proxies lesson-content requests to `POST /api/generate-lesson`, so the key
  never reaches the browser. Uses Gemini's `responseSchema` structured-output
  mode, so the model is constrained to valid JSON matching the lesson shape —
  no markdown-fence-stripping needed.
- `public/index.html` — the UI (topic, level, focus, duration → generate →
  preview → download).
- `public/lib/buildInteractivePptx.js` — the deck builder. Plans every slide's
  index up front (so hyperlinks can point forward and backward), builds the
  deck with `pptxgenjs`, then patches in transitions with `JSZip`.

## Extending it

- **Add a section**: add a slide-index to `planSlides()`, build the slide(s)
  in `buildInteractivePptx()`, and add a menu button pointing at it.
- **Change the transition**: swap `<p:fade/>` in `buildInteractivePptx.js` for
  `<p:push dir="l"/>`, `<p:wipe/>`, `<p:cut/>`, etc. — these are standard OOXML
  transition elements.
- **Deploy it**: any Node host works (Render, Railway, Fly.io, a VPS). Just set
  `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) as environment variables
  there instead of `.env`.

## Notes

- Default model is `gemini-2.5-flash`, set via `GEMINI_MODEL` in `.env`. Check
  https://ai.google.dev/gemini-api/docs/models for the current lineup if you
  want to switch models.
- Uses `pptxgenjs@3.12.0` and `jszip@3.10.1` from cdnjs — no build step needed.
