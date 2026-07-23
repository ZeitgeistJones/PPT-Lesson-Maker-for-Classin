/* buildInteractivePptx.js
 * Builds an interactive ESL lesson deck:
 *  - Title -> Menu (branching nav) -> sections, each with a "Menu" button
 *  - Warm-Up / Vocabulary / Speaking are click-to-reveal PAIRS of slides
 *    (a "prompt" slide with a button, and a separate "answer" slide it jumps to —
 *    this is the only reliable way to fake click-to-reveal in real PPTX, since
 *    PowerPoint's OOXML format has no click-triggered visibility toggle we can
 *    script from a browser without VBA macros).
 *  - After pptxgenjs builds the file, we unzip it (it's just a zip of XML),
 *    inject a native <p:transition> fade on every slide, and re-zip — pptxgenjs
 *    itself has no transition API, so this is done by hand.
 *
 * Requires globals: PptxGenJS, JSZip (both loaded via <script> tags)
 */

const COLORS = {
  blue: '3B82F6', navy: '1E3A5F', coral: 'FF6B6B', yellow: 'FFD93D', green: '34D399',
  lavender: 'EEF0FF', warmYellow: 'FFF9DB', peach: 'FFF0F0', white: 'FFFFFF',
  dark: '1E293B', gray: '64748B', lightGray: 'F1F5F9', purple: '8B5CF6',
};

// ---------- 1. Plan every slide's index BEFORE building anything ----------
// Hyperlinks need to know the target slide number, and some targets (like the
// menu) are referenced by slides that come before them, so we compute the
// whole layout as plain numbers first.
function planSlides(lesson) {
  let n = 0;
  const next = () => ++n;

  const plan = {};
  plan.title = next();
  plan.menu = next();

  plan.warmUpQ = next();
  plan.warmUpA = next();

  plan.vocabQ = next();
  plan.vocabA = next();

  plan.frames = next();

  plan.speaking = lesson.speakingQuestions.map(() => ({ q: next(), a: next() }));

  plan.activity = next();
  plan.final = next();

  plan.total = n;
  return plan;
}

// ---------- 2. Small helpers for consistent-looking buttons ----------
// A "button" is a rounded-rectangle shape (visual only) plus a text box on
// top carrying the hyperlink — in PowerPoint, a hyperlinked run makes its
// whole containing text box clickable in Slide Show mode, so this reads as
// one clickable button even though it's two objects.
function addButton(slide, { x, y, w, h, label, fill, textColor = COLORS.white, fontSize = 14, slideTarget, bold = true }) {
  slide.addShape('roundRect', { x, y, w, h, fill: { color: fill }, rectRadius: 0.12, line: { color: fill } });
  slide.addText(label, {
    x, y, w, h, align: 'center', valign: 'middle',
    fontSize, bold, color: textColor, fontFace: 'Calibri', margin: 0,
    hyperlink: { slide: slideTarget },
  });
}

function footerNav(slide, { backToMenu, next, nextLabel = 'Next →' }) {
  if (backToMenu) {
    addButton(slide, { x: 0.35, y: 5.05, w: 1.9, h: 0.45, label: '🏠 Menu', fill: COLORS.dark, fontSize: 13, slideTarget: backToMenu });
  }
  if (next) {
    addButton(slide, { x: 6.6, y: 5.05, w: 3.05, h: 0.45, label: nextLabel, fill: COLORS.coral, fontSize: 13, slideTarget: next });
  }
}

// ---------- 3. Build ----------
async function buildInteractivePptx(lesson, meta) {
  if (typeof PptxGenJS === 'undefined') throw new Error('PptxGenJS failed to load.');
  if (typeof JSZip === 'undefined') throw new Error('JSZip failed to load.');

  const plan = planSlides(lesson);
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';

  // --- Slide: Title ---
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.blue };
    s.addShape('ellipse', { x: -0.5, y: -0.5, w: 2, h: 2, fill: { color: COLORS.navy, transparency: 70 } });
    s.addShape('ellipse', { x: 8.5, y: 3.5, w: 3, h: 3, fill: { color: COLORS.navy, transparency: 70 } });
    s.addText(lesson.title, { x: 0.8, y: 1.0, w: 8.4, h: 1.5, fontSize: 40, bold: true, color: COLORS.white, align: 'center', fontFace: 'Calibri' });
    s.addText(`${meta.level} · Interactive Lesson · ${meta.duration} min`, { x: 0.8, y: 2.5, w: 8.4, h: 0.5, fontSize: 16, italic: true, color: COLORS.white, align: 'center', fontFace: 'Calibri' });
    addButton(s, { x: 3.65, y: 3.4, w: 2.7, h: 0.65, label: '▶  Start Lesson', fill: COLORS.white, textColor: COLORS.navy, fontSize: 18, slideTarget: plan.menu });
    s.addNotes('Click "Start Lesson" to go to the interactive menu. Every section links back here.');
  }

  // --- Slide: Menu ---
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.white };
    s.addText('Lesson Menu 🧭', { x: 0.6, y: 0.4, w: 8.8, h: 0.8, fontSize: 32, bold: true, color: COLORS.navy, align: 'center', fontFace: 'Calibri' });
    s.addText('Tap a section to jump to it. Every slide has a Menu button to come back.', { x: 0.6, y: 1.05, w: 8.8, h: 0.4, fontSize: 13, italic: true, color: COLORS.gray, align: 'center', fontFace: 'Calibri' });

    const items = [
      { label: '🔥  Warm-Up', target: plan.warmUpQ, fill: COLORS.coral },
      { label: '📚  New Words', target: plan.vocabQ, fill: COLORS.yellow, textColor: COLORS.dark },
      { label: '✨  Sentence Frames', target: plan.frames, fill: COLORS.purple },
      { label: '🗣️  Let\'s Talk', target: plan.speaking[0]?.q ?? plan.activity, fill: COLORS.green },
      { label: '🎯  Your Turn', target: plan.activity, fill: COLORS.blue },
      { label: '🎉  Wrap Up', target: plan.final, fill: COLORS.navy },
    ];
    const cols = 2, colW = 4.3, rowH = 0.95, gap = 0.2;
    items.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 0.6 + col * (colW + gap);
      const y = 1.65 + row * (rowH + gap);
      addButton(s, { x, y, w: colW, h: rowH, label: it.label, fill: it.fill, textColor: it.textColor, fontSize: 18, slideTarget: it.target });
    });
    s.addNotes('This is the hub. Use it to skip around depending on how the class is going.');
  }

  // --- Warm-Up: prompt -> reveal ---
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.white };
    s.addText("Let's Warm Up! 🔥", { x: 0.8, y: 0.5, w: 8.4, h: 0.8, fontSize: 34, bold: true, color: COLORS.navy, align: 'center', fontFace: 'Calibri' });
    s.addShape('roundRect', { x: 1.3, y: 1.6, w: 7.4, h: 1.8, fill: { color: COLORS.lavender }, rectRadius: 0.2 });
    s.addText(lesson.warmUp.question, { x: 1.6, y: 1.85, w: 6.8, h: 1.3, fontSize: 24, bold: true, color: COLORS.navy, align: 'center', valign: 'middle', fontFace: 'Calibri' });
    addButton(s, { x: 3.2, y: 3.75, w: 3.6, h: 0.6, label: '👀  Tap to Reveal a Sample Answer', fill: COLORS.coral, fontSize: 14, slideTarget: plan.warmUpA });
    footerNav(s, { backToMenu: plan.menu });
    s.addNotes('Let the student answer first before revealing the sample.');
  }
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.lavender };
    s.addText('Sample Answer 💡', { x: 0.8, y: 0.6, w: 8.4, h: 0.7, fontSize: 28, bold: true, color: COLORS.navy, align: 'center', fontFace: 'Calibri' });
    s.addShape('roundRect', { x: 1.3, y: 1.6, w: 7.4, h: 1.6, fill: { color: COLORS.white }, rectRadius: 0.2 });
    s.addText(`"${lesson.warmUp.sampleAnswer}"`, { x: 1.6, y: 1.8, w: 6.8, h: 1.2, fontSize: 22, italic: true, bold: true, color: COLORS.coral, align: 'center', valign: 'middle', fontFace: 'Calibri' });
    footerNav(s, { backToMenu: plan.menu, next: plan.vocabQ, nextLabel: 'Next: New Words →' });
    s.addNotes('Compare with the student\'s answer, then move on.');
  }

  // --- Vocabulary: prompt (words only) -> reveal (with sentences) ---
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.white };
    s.addText('New Words 📚', { x: 0.6, y: 0.35, w: 8.8, h: 0.7, fontSize: 30, bold: true, color: COLORS.navy, align: 'center', fontFace: 'Calibri' });
    const vocab = lesson.vocabulary.slice(0, 8);
    const perCol = Math.ceil(vocab.length / 2);
    const bg = [COLORS.lavender, COLORS.warmYellow, 'E0FFF4', COLORS.peach];
    vocab.forEach((v, i) => {
      const col = i < perCol ? 0 : 1, row = i % perCol;
      const cardH = Math.min(0.9, 3.4 / perCol - 0.1);
      const x = col === 0 ? 0.6 : 5.2, y = 1.15 + row * (cardH + 0.15);
      s.addShape('roundRect', { x, y, w: 4.2, h: cardH, fill: { color: bg[i % bg.length] }, rectRadius: 0.15 });
      s.addText(`${v.emoji}  ${v.word}`, { x: x + 0.2, y, w: 3.8, h: cardH, fontSize: 20, bold: true, color: COLORS.dark, valign: 'middle', fontFace: 'Calibri' });
    });
    addButton(s, { x: 3.1, y: 4.35, w: 3.8, h: 0.5, label: '👀  Tap to Reveal Example Sentences', fill: COLORS.yellow, textColor: COLORS.dark, fontSize: 13, slideTarget: plan.vocabA });
    footerNav(s, { backToMenu: plan.menu });
    s.addNotes('Say each word, have the student repeat, before revealing sentences.');
  }
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.white };
    s.addText('New Words — In Sentences 📚', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: COLORS.navy, align: 'center', fontFace: 'Calibri' });
    const vocab = lesson.vocabulary.slice(0, 8);
    const perCol = Math.ceil(vocab.length / 2);
    const bg = [COLORS.lavender, COLORS.warmYellow, 'E0FFF4', COLORS.peach];
    vocab.forEach((v, i) => {
      const col = i < perCol ? 0 : 1, row = i % perCol;
      const cardH = Math.min(1.05, 4.3 / perCol - 0.1);
      const x = col === 0 ? 0.55 : 5.15, y = 1.0 + row * (cardH + 0.12);
      s.addShape('roundRect', { x, y, w: 4.3, h: cardH, fill: { color: bg[i % bg.length] }, rectRadius: 0.12 });
      s.addText(`${v.emoji} ${v.word}`, { x: x + 0.15, y: y + 0.05, w: 4.0, h: cardH * 0.45, fontSize: 15, bold: true, color: COLORS.dark, fontFace: 'Calibri' });
      s.addText(v.sentence, { x: x + 0.15, y: y + cardH * 0.45, w: 4.0, h: cardH * 0.5, fontSize: 12, italic: true, color: COLORS.gray, fontFace: 'Calibri' });
    });
    footerNav(s, { backToMenu: plan.menu, next: plan.frames, nextLabel: 'Next: Sentence Frames →' });
    s.addNotes('Read each example, then ask the student to make their own sentence.');
  }

  // --- Sentence Frames (static practice, no reveal needed) ---
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.navy };
    s.addText('Sentence Frames ✨', { x: 0.8, y: 0.4, w: 8.4, h: 0.7, fontSize: 32, bold: true, color: COLORS.white, align: 'center', fontFace: 'Calibri' });
    const dots = [COLORS.coral, COLORS.yellow, COLORS.green, COLORS.blue];
    lesson.sentenceFrames.slice(0, 4).forEach((f, i) => {
      const y = 1.35 + i * 0.85;
      s.addShape('ellipse', { x: 1.0, y: y + 0.13, w: 0.32, h: 0.32, fill: { color: dots[i] } });
      s.addText(f, { x: 1.55, y, w: 7.3, h: 0.6, fontSize: 22, bold: true, color: COLORS.white, valign: 'middle', fontFace: 'Calibri' });
    });
    footerNav(s, { backToMenu: plan.menu, next: plan.speaking[0]?.q ?? plan.activity, nextLabel: "Next: Let's Talk →" });
    s.addNotes('Model each frame, then have the student fill the blank aloud.');
  }

  // --- Speaking questions: prompt -> reveal, chained ---
  lesson.speakingQuestions.forEach((item, i) => {
    const isLast = i === lesson.speakingQuestions.length - 1;
    const { q: qIdx, a: aIdx } = plan.speaking[i];

    { // prompt
      const s = pres.addSlide();
      s.background = { color: COLORS.white };
      s.addText("Let's Talk! 🗣️", { x: 0.8, y: 0.4, w: 8.4, h: 0.6, fontSize: 28, bold: true, color: COLORS.navy, align: 'center', fontFace: 'Calibri' });
      s.addText(`Question ${i + 1} of ${lesson.speakingQuestions.length}`, { x: 0.8, y: 0.95, w: 8.4, h: 0.35, fontSize: 12, color: COLORS.gray, align: 'center', fontFace: 'Calibri' });
      s.addShape('roundRect', { x: 1.2, y: 1.5, w: 7.6, h: 1.7, fill: { color: COLORS.lavender }, rectRadius: 0.18 });
      s.addText(`❓ ${item.question}`, { x: 1.5, y: 1.7, w: 7.0, h: 1.3, fontSize: 22, bold: true, color: COLORS.navy, align: 'center', valign: 'middle', fontFace: 'Calibri' });
      addButton(s, { x: 3.15, y: 3.55, w: 3.7, h: 0.55, label: '👀  Tap to Reveal Sample Answer', fill: COLORS.green, fontSize: 13, slideTarget: aIdx });
      footerNav(s, { backToMenu: plan.menu });
      s.addNotes('Wait for a complete-sentence answer before revealing the sample.');
    }
    { // reveal
      const s = pres.addSlide();
      s.background = { color: 'E0FFF4' };
      s.addText('Sample Answer 💬', { x: 0.8, y: 0.5, w: 8.4, h: 0.6, fontSize: 26, bold: true, color: COLORS.navy, align: 'center', fontFace: 'Calibri' });
      s.addShape('roundRect', { x: 1.2, y: 1.5, w: 7.6, h: 1.5, fill: { color: COLORS.white }, rectRadius: 0.18 });
      s.addText(`"${item.sampleAnswer}"`, { x: 1.5, y: 1.7, w: 7.0, h: 1.1, fontSize: 20, italic: true, bold: true, color: COLORS.green, align: 'center', valign: 'middle', fontFace: 'Calibri' });
      footerNav(s, {
        backToMenu: plan.menu,
        next: isLast ? plan.activity : plan.speaking[i + 1].q,
        nextLabel: isLast ? 'Next: Your Turn →' : 'Next Question →',
      });
      s.addNotes(isLast ? 'Last question — move to the speaking activity.' : 'Move to the next question.');
    }
  });

  // --- Activity ---
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.white };
    s.addText('Your Turn! 🎯', { x: 0.8, y: 0.3, w: 8.4, h: 0.6, fontSize: 30, bold: true, color: COLORS.navy, align: 'center', fontFace: 'Calibri' });
    s.addText(lesson.activity.prompt, { x: 0.8, y: 0.9, w: 8.4, h: 0.5, fontSize: 15, color: COLORS.gray, align: 'center', fontFace: 'Calibri' });
    lesson.activity.templates.slice(0, 4).forEach((t, i) => {
      const y = 1.55 + i * 0.68;
      s.addShape('roundRect', { x: 1.0, y, w: 8, h: 0.55, fill: { color: i % 2 === 0 ? COLORS.lavender : COLORS.warmYellow }, rectRadius: 0.1 });
      s.addText(`${i + 1}.  ${t}`, { x: 1.3, y, w: 7.4, h: 0.55, fontSize: 18, bold: true, color: COLORS.dark, valign: 'middle', fontFace: 'Calibri' });
    });
    footerNav(s, { backToMenu: plan.menu, next: plan.final, nextLabel: 'Finish →' });
    s.addNotes('Guide the student through each template out loud.');
  }

  // --- Final / Wrap-up ---
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.blue };
    s.addShape('ellipse', { x: 7.5, y: -1, w: 3.5, h: 3.5, fill: { color: COLORS.navy, transparency: 70 } });
    s.addShape('ellipse', { x: -1, y: 3.5, w: 3, h: 3, fill: { color: COLORS.navy, transparency: 70 } });
    s.addText('Great Job! 🎉', { x: 0.8, y: 0.6, w: 8.4, h: 1.0, fontSize: 42, bold: true, color: COLORS.white, align: 'center', fontFace: 'Calibri' });
    s.addText("Today's Key Sentences:", { x: 0.8, y: 1.65, w: 8.4, h: 0.4, fontSize: 15, italic: true, color: COLORS.white, align: 'center', fontFace: 'Calibri' });
    lesson.reviewSentences.slice(0, 3).forEach((r, i) => {
      s.addText(`⭐  ${r}`, { x: 1.5, y: 2.15 + i * 0.55, w: 7, h: 0.5, fontSize: 17, color: COLORS.white, align: 'center', fontFace: 'Calibri' });
    });
    addButton(s, { x: 1.6, y: 4.15, w: 3.0, h: 0.55, label: '🏠  Back to Menu', fill: COLORS.white, textColor: COLORS.navy, fontSize: 14, slideTarget: plan.menu });
    addButton(s, { x: 5.4, y: 4.15, w: 3.0, h: 0.55, label: '🔁  Restart Lesson', fill: COLORS.navy, textColor: COLORS.white, fontSize: 14, slideTarget: plan.title });
    s.addNotes('Wrap up — review the sentences and praise effort.');
  }

  // ---------- 4. Generate, then patch in real fade transitions ----------
  const arrayBuffer = await pres.write({ outputType: 'arraybuffer' });
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  await Promise.all(
    slideFiles.map(async (f) => {
      let xml = await zip.file(f).async('string');
      if (!xml.includes('<p:transition')) {
        // <p:transition> must sit between </p:cSld> and </p:sld> per the OOXML schema.
        xml = xml.replace('</p:cSld>', '</p:cSld><p:transition spd="med"><p:fade/></p:transition>');
        zip.file(f, xml);
      }
    })
  );

  const outBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

  const fileName = (lesson.title || 'Lesson').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-') + '-Interactive.pptx';
  const url = URL.createObjectURL(outBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return { slideCount: plan.total, fileName };
}