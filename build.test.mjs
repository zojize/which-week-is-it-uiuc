import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildContent } from './build.mjs';
import { semesters } from './lib.mjs';

// ---------------------------------------------------------------------------
// Helpers — independent reimplementations so test correctness does not depend
// on the same code paths as the code under test.
// ---------------------------------------------------------------------------

function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function mondayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function weekOf(semStart, date, breaks = []) {
  const start = parseLocal(semStart);
  const dow = start.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const firstMonday = new Date(start);
  firstMonday.setDate(firstMonday.getDate() - mondayOffset);
  const firstMondayUTC = Date.UTC(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate());
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  const skippedBreakWeeks = new Set();
  for (const br of breaks) {
    const breakStart = parseLocal(br.start);
    const breakEnd = parseLocal(br.end);
    if (breakStart > date) continue;

    const startCursor = breakStart > firstMonday ? breakStart : firstMonday;
    const endCursor = breakEnd < date ? breakEnd : date;
    const cursor = new Date(startCursor);

    while (cursor <= endCursor) {
      const day = cursor.getDay();
      if (day >= 1 && day <= 5) {
        const monday = new Date(cursor);
        monday.setDate(monday.getDate() - (day - 1));
        skippedBreakWeeks.add(mondayKey(monday));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return Math.floor((dateUTC - firstMondayUTC) / 86400000 / 7) + 1 - skippedBreakWeeks.size;
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

// Semester data is imported from lib.mjs — the single source of truth.

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeAll(() => { vi.useFakeTimers(); });
afterAll(() => { vi.useRealTimers(); });

describe.each(semesters)('$name', (sem) => {
  
  it('shows correct week number and semester for every day', () => {
    const days = eachDay(parseLocal(sem.start), parseLocal(sem.end));
    const all = [];

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

        all.push([dateStr, el.textContent]);
      } else {
        // During a regular week the page should show the correct week number
        const el = locator('.week-display');
        expect(el, `${dateStr}: expected .week-display element`).not.toBeNull();

        const weekNum = weekOf(sem.start, day, sem.breaks);
        const suffix = ordinalSuffix(weekNum);
        // textContent of "7<sup>th</sup> Week" → "7th Week"
        expect(el.textContent, `${dateStr}: week number`).toContain(`${weekNum}${suffix}`);

        const semInfo = locator('.semester-info');
        expect(semInfo, `${dateStr}: expected .semester-info element`).not.toBeNull();
        expect(semInfo.textContent, `${dateStr}: semester info`).toContain(sem.name);

        all.push([dateStr, `${weekNum}${suffix} Week`]);
      }
    }

    expect(all).toMatchSnapshot();
  });
});
