import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildContent } from './build.mjs';

// ---------------------------------------------------------------------------
// Helpers — mirror the logic in build.mjs so we can compute expected values
// independently of the code under test.
// ---------------------------------------------------------------------------

function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function weekOf(semStart, date) {
  const start = parseLocal(semStart);
  const dow = start.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const firstMonday = new Date(start);
  firstMonday.setDate(firstMonday.getDate() - mondayOffset);
  return Math.floor((date - firstMonday) / 86400000 / 7) + 1;
}

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/** Iterate every calendar day from start to end (inclusive). */
function eachDay(start, end) {
  const days = [];
  const d = new Date(start);
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * Locator helper — equivalent to page.locator(selector) from the
 * vitest browser locator API (https://vitest.dev/api/browser/locators.html).
 * In the happy-dom environment, document.querySelector provides the same
 * element-finding capability.
 */
function locator(selector) {
  return document.querySelector(selector);
}

// ---------------------------------------------------------------------------
// Semester data — kept in sync with build.mjs
// ---------------------------------------------------------------------------

const semesters = [
  { name: 'Summer 2025', year: '2024–2025', start: '2025-05-19', end: '2025-08-07', breaks: [] },
  {
    name: 'Fall 2025', year: '2025–2026', start: '2025-08-25', end: '2025-12-10',
    breaks: [{ name: 'Fall Break', start: '2025-11-22', end: '2025-11-30' }],
  },
  {
    name: 'Spring 2026', year: '2025–2026', start: '2026-01-20', end: '2026-05-06',
    breaks: [{ name: 'Spring Break', start: '2026-03-14', end: '2026-03-22' }],
  },
  { name: 'Summer 2026', year: '2025–2026', start: '2026-05-18', end: '2026-08-06', breaks: [] },
  {
    name: 'Fall 2026', year: '2026–2027', start: '2026-08-24', end: '2026-12-09',
    breaks: [{ name: 'Fall Break', start: '2026-11-21', end: '2026-11-29' }],
  },
  { name: 'Spring 2027', year: '2026–2027', start: '2027-01-19', end: '2027-05-05', breaks: [] },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeAll(() => { vi.useFakeTimers(); });
afterAll(() => { vi.useRealTimers(); });

describe.each(semesters)('$name', (sem) => {
  it('shows correct week number and semester for every day', () => {
    const days = eachDay(parseLocal(sem.start), parseLocal(sem.end));

    for (const day of days) {
      // Control what new Date() returns inside buildContent()
      vi.setSystemTime(day);

      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

      const { content } = buildContent();
      document.body.innerHTML = content;

      const onBreak = sem.breaks.find(
        (br) => day >= parseLocal(br.start) && day <= parseLocal(br.end),
      );

      if (onBreak) {
        // During a break the page should show the break name, not a week number
        const el = locator('.off-semester');
        expect(el, `${dateStr}: expected .off-semester element`).not.toBeNull();
        expect(el.textContent, `${dateStr}: break name`).toBe(onBreak.name);

        const semInfo = locator('.semester-info');
        expect(semInfo, `${dateStr}: expected .semester-info element`).not.toBeNull();
        expect(semInfo.textContent, `${dateStr}: semester info`).toContain(sem.name);
      } else {
        // During a regular week the page should show the correct week number
        const el = locator('.week-display');
        expect(el, `${dateStr}: expected .week-display element`).not.toBeNull();

        const weekNum = weekOf(sem.start, day);
        const suffix = ordinalSuffix(weekNum);
        // textContent of "7<sup>th</sup> Week" → "7th Week"
        expect(el.textContent, `${dateStr}: week number`).toContain(`${weekNum}${suffix}`);

        const semInfo = locator('.semester-info');
        expect(semInfo, `${dateStr}: expected .semester-info element`).not.toBeNull();
        expect(semInfo.textContent, `${dateStr}: semester info`).toContain(sem.name);
      }
    }
  });
});
