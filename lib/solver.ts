// Routine solver: picks one section per course so that nothing clashes and
// everything fits the student's days and times. No UI code here.
//
// It is a constraint satisfaction problem:
//   - each course is a variable, its sections are the possible values
//   - pre-filter: drop sections outside the chosen days/times
//   - backtracking search, always choosing the course with the fewest sections left (MRV)
//   - forward checking: after picking a section, remove clashing sections from the
//     other courses and back up as soon as some course has none left
//
// Sections of a course that meet at exactly the same days and times (only the
// faculty/room differ) behave the same for clashes and gaps, so the search works
// on these "time patterns". Each plan is one combination of patterns; the other
// sections at the same time are listed as alternatives.
//
// Plans are ranked by least free time between classes.

import type { Course, Plan, Preferences, Section } from "./types";

export const MAX_PLANS = 5;

/** A break this short (e.g. 09:50 -> 09:51, or a lab ending 13:40 before a 13:51 class) is not a gap. */
export const SHORT_BREAK_MIN = 20;

/**
 * How many complete combinations to compare before picking the best ones. Normal
 * loads have far fewer, so every combination is compared. For very large searches
 * the most promising combinations are tried first, so stopping here still gives
 * very good plans without freezing the page.
 */
const SEARCH_LIMIT = 60_000;

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function isIfRequired(section: Section): boolean {
  return /if required/i.test(section.note ?? "");
}

/** Does every meeting of this section fall on a chosen day and inside the chosen times? */
export function sectionFits(section: Section, prefs: Preferences): boolean {
  const start = toMinutes(prefs.start);
  const end = toMinutes(prefs.end);
  return section.meetings.every(
    (m) => prefs.days.includes(m.day) && toMinutes(m.start) >= start && toMinutes(m.end) <= end,
  );
}

/** Do two sections overlap in time on the same day? */
export function sectionsClash(a: Section, b: Section): boolean {
  return a.meetings.some((x) =>
    b.meetings.some(
      (y) => x.day === y.day && toMinutes(x.start) < toMinutes(y.end) && toMinutes(y.start) < toMinutes(x.end),
    ),
  );
}

/** Sections of each course that pass the day/time pre-filter. */
export function validSections(courses: Course[], prefs: Preferences, allowIfRequired = true): Section[][] {
  return courses.map((c) =>
    c.sections.filter((s) => sectionFits(s, prefs) && (allowIfRequired || !isIfRequired(s))),
  );
}

/** Total free time between classes, in minutes, added up over every day. */
export function gapMinutes(sections: Section[]): number {
  return gapOf(sections.map(toSlots));
}

export function campusDays(sections: Section[]): number {
  return new Set(sections.flatMap((s) => s.meetings.map((m) => m.day))).size;
}

// ---------------------------------------------------------------------------
// internals

type Slot = [day: string, start: number, end: number];

const toSlots = (s: Section): Slot[] => s.meetings.map((m) => [m.day, toMinutes(m.start), toMinutes(m.end)]);

function gapOf(slotLists: Slot[][]): number {
  const byDay = new Map<string, Slot[]>();
  for (const list of slotLists)
    for (const sl of list) {
      const d = byDay.get(sl[0]);
      if (d) d.push(sl);
      else byDay.set(sl[0], [sl]);
    }
  let total = 0;
  for (const list of byDay.values()) {
    list.sort((a, b) => a[1] - b[1]);
    for (let i = 1; i < list.length; i++) {
      const gap = list[i][1] - list[i - 1][2];
      if (gap > SHORT_BREAK_MIN) total += gap;
    }
  }
  return total;
}

interface Pattern {
  course: number; // index into the course list
  slots: Slot[];
  sections: Section[]; // normal sections first
  ifOnly: boolean; // every section here is "If required"
  days: string[];
}

/** Group each course's sections by identical days and times. */
function buildPatterns(domains: Section[][]): Pattern[][] {
  return domains.map((secs, course) => {
    const map = new Map<string, Pattern>();
    for (const s of secs) {
      const slots = toSlots(s).sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
      const key = slots.map((x) => x.join(",")).join(";");
      const p = map.get(key);
      if (p) p.sections.push(s);
      else map.set(key, { course, slots, sections: [s], ifOnly: false, days: [...new Set(slots.map((x) => x[0]))] });
    }
    const list = [...map.values()];
    for (const p of list) {
      p.sections.sort((a, b) => Number(isIfRequired(a)) - Number(isIfRequired(b)));
      p.ifOnly = p.sections.every(isIfRequired);
    }
    return list;
  });
}

const slotsClash = (a: Slot[], b: Slot[]) =>
  a.some((x) => b.some((y) => x[0] === y[0] && x[1] < y[2] && y[1] < x[2]));

/**
 * Backtracking with MRV and forward checking over time patterns.
 * Calls `accept` with the chosen pattern of each course; stops when it returns false.
 */
function search(patterns: Pattern[][], accept: (picked: Pattern[]) => boolean): void {
  const n = patterns.length;
  if (n === 0 || patterns.some((d) => d.length === 0)) return;

  // Number every pattern and work out once which pairs clash.
  const all = patterns.flat();
  const id = new Map(all.map((p, i) => [p, i]));
  const N = all.length;
  const clash = new Uint8Array(N * N);
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++)
      if (all[i].course !== all[j].course && slotsClash(all[i].slots, all[j].slots)) clash[i * N + j] = clash[j * N + i] = 1;

  const picked: number[] = new Array(n).fill(-1);
  let stopped = false;

  function step(domains: number[][]): void {
    let next = -1;
    for (let i = 0; i < n; i++)
      if (picked[i] === -1 && (next === -1 || domains[i].length < domains[next].length)) next = i;
    if (next === -1) {
      if (!accept(picked.map((p) => all[p]))) stopped = true;
      return;
    }
    // Try first the patterns that add the least gap to what is already picked,
    // so the best plans are found early.
    const chosen = picked.filter((q) => q !== -1).map((q) => all[q].slots);
    const order =
      chosen.length === 0
        ? domains[next]
        : domains[next]
            .map((p) => [p, gapOf([...chosen, all[p].slots])] as const)
            .sort((a, b) => a[1] - b[1])
            .map(([p]) => p);
    for (const p of order) {
      const row = p * N;
      const reduced: number[][] = new Array(n);
      let dead = false;
      for (let i = 0; i < n; i++) {
        if (i === next || picked[i] !== -1) {
          reduced[i] = domains[i];
          continue;
        }
        const d = domains[i].filter((q) => clash[row + q] === 0);
        if (d.length === 0) {
          dead = true;
          break;
        }
        reduced[i] = d;
      }
      if (dead) continue;
      picked[next] = p;
      step(reduced);
      picked[next] = -1;
      if (stopped) return;
    }
  }

  step(patterns.map((d) => d.map((p) => id.get(p)!)));
}

interface Scored {
  picked: Pattern[];
  gap: number;
  days: number;
}
const better = (a: Scored, b: Scored) => a.gap - b.gap || a.days - b.days;

/** Compare the combinations `search` finds and keep the `max` with the smallest gaps. */
function bestCombos(patterns: Pattern[][], max: number, keep: (picked: Pattern[]) => boolean): Scored[] {
  const best: Scored[] = [];
  let seen = 0;
  search(patterns, (picked) => {
    if (keep(picked)) {
      const cand: Scored = {
        picked,
        gap: gapOf(picked.map((p) => p.slots)),
        days: new Set(picked.flatMap((p) => p.days)).size,
      };
      if (best.length < max || better(cand, best[best.length - 1]) < 0) {
        best.push(cand);
        best.sort(better);
        if (best.length > max) best.pop();
      }
    }
    return ++seen < SEARCH_LIMIT;
  });
  return best;
}

// ---------------------------------------------------------------------------
// public API

/** True if at least one clash-free plan exists for these courses. */
export function isSolvable(courses: Course[], prefs: Preferences): boolean {
  let found = false;
  search(buildPatterns(validSections(courses, prefs)), () => {
    found = true;
    return false;
  });
  return found;
}

/**
 * Find up to `max` plans with different class times, least free time between
 * classes first (ties: fewer days at uni first). Plans that use no "If required"
 * section always come before plans that need one.
 */
export function findPlans(courses: Course[], prefs: Preferences, max = MAX_PLANS): Plan[] {
  if (courses.length === 0) return [];

  // Pass 1: normal sections only.
  const results = bestCombos(buildPatterns(validSections(courses, prefs, false)), max, () => true);

  // Pass 2: if still short, allow "If required" sections. Pass 1 already covered every
  // time combination possible without them, so only keep ones that need one.
  if (results.length < max) {
    const withIf = buildPatterns(validSections(courses, prefs, true));
    results.push(...bestCombos(withIf, max - results.length, (picked) => picked.some((p) => p.ifOnly)));
  }

  return results.map(({ picked, gap, days }) => ({
    choices: picked.map((p) => ({
      course: courses[p.course],
      section: p.sections[0],
      alternatives: p.sections.slice(1),
    })),
    usesIfRequired: picked.some((p) => isIfRequired(p.sections[0])),
    gapMinutes: gap,
    campusDays: days,
  }));
}
