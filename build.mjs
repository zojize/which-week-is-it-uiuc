import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';

const semesters = [
  { name: 'Summer 2025', year: '2024–2025', start: '2025-05-19', end: '2025-08-07' },
  { name: 'Fall 2025',   year: '2025–2026', start: '2025-08-25', end: '2025-12-10' },
  { name: 'Spring 2026', year: '2025–2026', start: '2026-01-20', end: '2026-05-06' },
  { name: 'Summer 2026', year: '2025–2026', start: '2026-05-18', end: '2026-08-06' },
  { name: 'Fall 2026',   year: '2026–2027', start: '2026-08-24', end: '2026-12-09' },
  { name: 'Spring 2027', year: '2026–2027', start: '2027-01-19', end: '2027-05-05' },
];

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Use CST (UTC-6) to match UIUC's timezone
const now = new Date();
const cst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
const today = new Date(cst.getFullYear(), cst.getMonth(), cst.getDate());

let content = '';
let title = 'Which Week Is It? — UIUC';

let current = null;
for (const sem of semesters) {
  const start = new Date(sem.start + 'T00:00:00');
  const end = new Date(sem.end + 'T23:59:59');
  if (today >= start && today <= end) {
    current = sem;
    break;
  }
}

if (current) {
  const start = new Date(current.start + 'T00:00:00');
  const diffDays = Math.floor((today - start) / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  const suffix = ordinalSuffix(weekNum);
  title = `${weekNum}${suffix} Week — UIUC`;
  content = `<div class="week-display">${weekNum}<sup>${suffix}</sup> Week</div>
    <div class="semester-info">${current.name} &middot; ${current.year}</div>`;
} else {
  let next = null;
  for (const sem of semesters) {
    if (today < new Date(sem.start + 'T00:00:00')) { next = sem; break; }
  }
  const msg = next ? `Classes resume ${next.start}` : 'Enjoy the break';
  content = `<div class="off-semester">Not in session</div>
    <div class="off-semester-sub">${msg}</div>`;
}

const BASE_URL = 'https://zojize.github.io/which-week-is-it-uiuc';

// Generate OG image as SVG
let ogDescription = '';
let ogMainText = '';
let ogSubText = '';
if (current) {
  const start = new Date(current.start + 'T00:00:00');
  const diffDays = Math.floor((today - start) / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  const suffix = ordinalSuffix(weekNum);
  ogMainText = `${weekNum}${suffix} Week`;
  ogSubText = `${current.name} · ${current.year}`;
  ogDescription = `It's the ${weekNum}${suffix} week of ${current.name} at UIUC.`;
} else {
  ogMainText = 'Not in session';
  ogSubText = '';
  ogDescription = 'UIUC is not currently in session.';
}

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
