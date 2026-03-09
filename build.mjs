import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';

const semesters = [
  { name: 'Summer 2025', year: '2024–2025', start: '2025-05-19', end: '2025-08-07', breaks: [] },
  { name: 'Fall 2025',   year: '2025–2026', start: '2025-08-25', end: '2025-12-10', breaks: [
    { name: 'Fall Break',   start: '2025-11-22', end: '2025-11-30' },
  ]},
  { name: 'Spring 2026', year: '2025–2026', start: '2026-01-20', end: '2026-05-06', breaks: [
    { name: 'Spring Break', start: '2026-03-14', end: '2026-03-22' },
  ]},
  { name: 'Summer 2026', year: '2025–2026', start: '2026-05-18', end: '2026-08-06', breaks: [] },
  { name: 'Fall 2026',   year: '2026–2027', start: '2026-08-24', end: '2026-12-09', breaks: [
    { name: 'Fall Break',   start: '2026-11-21', end: '2026-11-29' },
  ]},
  { name: 'Spring 2027', year: '2026–2027', start: '2027-01-19', end: '2027-05-05', breaks: [
    // Spring Break dates TBD; calendar not yet published
  ]},
];

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Parse YYYY-MM-DD as local (Chicago) time, not UTC
function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Align to the Monday of the week containing the semester start.
// Use Date.UTC for the day-count arithmetic to avoid DST skewing the result
// (e.g. spring-forward makes a Monday appear to be 48.96 days instead of 49).
function weekOf(semStart, date) {
  const start = parseLocal(semStart);
  const dow = start.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const firstMonday = new Date(start);
  firstMonday.setDate(firstMonday.getDate() - mondayOffset);
  const firstMondayUTC = Date.UTC(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate());
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((dateUTC - firstMondayUTC) / 86400000 / 7) + 1;
}

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
      const weekNum = weekOf(current.start, today);
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
      const weekNum = weekOf(current.start, today);
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
  const html = template
    .replaceAll('{{TITLE}}', title)
    .replaceAll('{{CONTENT}}', content)
    .replaceAll('{{BUILD_DATE}}', buildDate)
    .replaceAll('{{OG_DESCRIPTION}}', ogDescription)
    .replaceAll('{{BASE_URL}}', BASE_URL);

  writeFileSync('index.html', html);
  console.log(`Built index.html: ${title}`);
}
