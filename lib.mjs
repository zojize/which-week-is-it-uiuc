const semesters = [
  { name: 'Summer 2025', year: '2024\u20132025', start: '2025-05-19', end: '2025-08-07', breaks: [] },
  { name: 'Fall 2025',   year: '2025\u20132026', start: '2025-08-25', end: '2025-12-10', breaks: [
    { name: 'Fall Break',   start: '2025-11-22', end: '2025-11-30' },
  ]},
  { name: 'Spring 2026', year: '2025\u20132026', start: '2026-01-20', end: '2026-05-06', breaks: [
    { name: 'Spring Break', start: '2026-03-14', end: '2026-03-22' },
  ]},
  { name: 'Summer 2026', year: '2025\u20132026', start: '2026-05-18', end: '2026-08-06', breaks: [] },
  { name: 'Fall 2026',   year: '2026\u20132027', start: '2026-08-24', end: '2026-12-09', breaks: [
    { name: 'Fall Break',   start: '2026-11-21', end: '2026-11-29' },
  ]},
  { name: 'Spring 2027', year: '2026\u20132027', start: '2027-01-19', end: '2027-05-05', breaks: [
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

function mondayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Align to the Monday of the week containing the semester start.
// Use Date.UTC for the day-count arithmetic to avoid DST skewing the result
// (e.g. spring-forward makes a Monday appear to be 48.96 days instead of 49).
function weekOf(semStart, date, breaks = []) {
  const start = parseLocal(semStart);
  const dow = start.getDay(); // 0=Sun, 1=Mon, ...
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

export { semesters, ordinalSuffix, parseLocal, mondayKey, weekOf };
