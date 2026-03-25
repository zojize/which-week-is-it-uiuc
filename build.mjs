import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import { semesters, ordinalSuffix, parseLocal, weekOf } from './lib.mjs';

// Exported for testing — uses new Date() internally so the date can be
// controlled in tests via vi.setSystemTime().
export function buildContent() {
  // TZ=America/Chicago is set when run via the build script, so local time is CST/CDT
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let content = '';
  let title = 'Which Week Is It? — UIUC';

  let current = null;
  for (const sem of semesters) {
    const start = parseLocal(sem.start);
    const end = parseLocal(sem.end);
    if (today >= start && today <= end) {
      current = sem;
      break;
    }
  }

  // Check if today falls within a scheduled break
  const currentBreak = current?.breaks.find(
    br => today >= parseLocal(br.start) && today <= parseLocal(br.end)
  ) ?? null;

  if (current) {
    if (currentBreak) {
      title = `${currentBreak.name} — UIUC`;
      content = `<div class="off-semester">${currentBreak.name}</div>
    <div class="semester-info">${current.name} &middot; ${current.year}</div>`;
    } else {
      const weekNum = weekOf(current.start, today, current.breaks);
      const suffix = ordinalSuffix(weekNum);
      title = `${weekNum}${suffix} Week — UIUC`;
      content = `<div class="week-display">${weekNum}<sup>${suffix}</sup> Week</div>
    <div class="semester-info">${current.name} &middot; ${current.year}</div>`;
    }
  } else {
    let next = null;
    for (const sem of semesters) {
      if (today < parseLocal(sem.start)) { next = sem; break; }
    }
    const msg = next ? `Classes resume ${next.start}` : 'Enjoy the break';
    content = `<div class="off-semester">Not in session</div>
    <div class="off-semester-sub">${msg}</div>`;
  }

  let ogDescription = '';
  let ogMainText = '';
  let ogSubText = '';
  if (current) {
    if (currentBreak) {
      ogMainText = currentBreak.name;
      ogSubText = `${current.name} · ${current.year}`;
      ogDescription = `It's ${currentBreak.name} for ${current.name} at UIUC.`;
    } else {
      const weekNum = weekOf(current.start, today, current.breaks);
      const suffix = ordinalSuffix(weekNum);
      ogMainText = `${weekNum}${suffix} Week`;
      ogSubText = `${current.name} · ${current.year}`;
      ogDescription = `It's the ${weekNum}${suffix} week of ${current.name} at UIUC.`;
    }
  } else {
    ogMainText = 'Not in session';
    ogSubText = '';
    ogDescription = 'UIUC is not currently in session.';
  }

  return { title, content, ogMainText, ogSubText, ogDescription };
}

// Only run file I/O when executed directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { title, content, ogMainText, ogSubText, ogDescription } = buildContent();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const BASE_URL = 'https://zojize.github.io/which-week-is-it-uiuc';

  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#13294B"/>
  <text x="600" y="${ogSubText ? 290 : 330}" text-anchor="middle" font-family="'Bebas Neue'" font-size="160" fill="#FF5F05" letter-spacing="4">${ogMainText}</text>
  ${ogSubText ? `<text x="600" y="400" text-anchor="middle" font-family="'Bebas Neue'" font-size="40" fill="#C8C6C7" letter-spacing="4">${ogSubText}</text>` : ''}
  <text x="600" y="560" text-anchor="middle" font-family="'Bebas Neue'" font-size="28" fill="#707372" letter-spacing="2">WHICH WEEK IS IT? — UIUC</text>
</svg>`;
  const resvg = new Resvg(ogSvg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontFiles: ['fonts/BebasNeue-Regular.ttf'], loadSystemFonts: false },
  });
  writeFileSync('og.png', resvg.render().asPng());

  const template = readFileSync('template.html', 'utf-8');
  const buildDate = today.toISOString().slice(0, 10);
  // Strip the ES-module export line so the injected code works as a plain script
  const sharedLib = readFileSync(new URL('./lib.mjs', import.meta.url), 'utf-8')
    .replace(/\nexport\s*\{[^}]*\};\s*$/, '');
  const html = template
    .replaceAll('{{TITLE}}', title)
    .replaceAll('{{CONTENT}}', content)
    .replaceAll('{{BUILD_DATE}}', buildDate)
    .replaceAll('{{OG_DESCRIPTION}}', ogDescription)
    .replaceAll('{{BASE_URL}}', BASE_URL)
    .replaceAll('{{SHARED_LIB}}', sharedLib);

  writeFileSync('index.html', html);
  console.log(`Built index.html: ${title}`);
}
