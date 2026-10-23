// Explains, in plain words, why no routine could be built,
// and suggests what the student could change.

import { isSolvable, toMinutes, validSections, sectionsClash } from "./solver";
import type { Course, Preferences, Section } from "./types";

export const FAIL_MESSAGE = "nah bruh can't cook ur routine";

export interface Explanation {
  reasons: string[];
  suggestions: string[];
}

export interface ExplainOptions {
  allDays: string[]; // every day the uni runs classes
  startSlots: string[];
  endSlots: string[];
}

const short = (day: string) => day.slice(0, 3);
const label = (c: Course) => `${c.code} (${c.title})`;

function listWords(items: string[], joiner = "and"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${joiner} ${items[items.length - 1]}`;
}

/** e.g. "Sat & Tue 08:30–09:50, Mon 14:00–16:30" */
function describeTimes(sections: Section[], limit = 4): string {
  const patterns: string[] = [];
  for (const s of sections) {
    const days = s.meetings.map((m) => short(m.day)).join(" & ");
    const sameTime = s.meetings.every((m) => m.start === s.meetings[0].start && m.end === s.meetings[0].end);
    const p = sameTime
      ? `${days} ${s.meetings[0].start}–${s.meetings[0].end}`
      : s.meetings.map((m) => `${short(m.day)} ${m.start}–${m.end}`).join(" & ");
    if (!patterns.includes(p)) patterns.push(p);
  }
  const shown = patterns.slice(0, limit).join(", ");
  return patterns.length > limit ? `${shown} and ${patterns.length - limit} more` : shown;
}

/** Problems with the inputs themselves (nothing to solve yet). Empty list = inputs are fine. */
export function checkInputs(courses: Course[], prefs: Preferences): string[] {
  const missing: string[] = [];
  if (courses.length === 0) missing.push("You haven't added any courses yet. Search for a course and press Add.");
  if (prefs.days.length === 0) missing.push("You haven't picked any days. Tick at least one day you can come to uni.");
  if (toMinutes(prefs.start) >= toMinutes(prefs.end))
    missing.push(`Your start time (${prefs.start}) is not before your end time (${prefs.end}).`);
  return missing;
}

function* combinations<T>(items: T[], k: number, from = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc;
    return;
  }
  for (let i = from; i <= items.length - (k - acc.length); i++) yield* combinations(items, k, i + 1, [...acc, items[i]]);
}

/** Why can't these courses fit? Call only when findPlans returned nothing. */
export function explainFailure(courses: Course[], prefs: Preferences, opts: ExplainOptions): Explanation {
  const inputProblems = checkInputs(courses, prefs);
  if (inputProblems.length) return { reasons: inputProblems, suggestions: [] };

  const reasons: string[] = [];
  const domains = validSections(courses, prefs);

  // 1. A single course has no section inside the chosen days/times.
  courses.forEach((c, i) => {
    if (domains[i].length === 0)
      reasons.push(`${label(c)} has no section on your chosen days/times. Its sections run: ${describeTimes(c.sections)}.`);
  });

  // 2. Two courses always clash.
  if (reasons.length === 0) {
    for (let i = 0; i < courses.length; i++)
      for (let j = i + 1; j < courses.length; j++)
        if (domains[i].every((a) => domains[j].every((b) => sectionsClash(a, b))))
          reasons.push(
            `Every section of ${label(courses[i])} that fits your days/times clashes with every section of ${label(courses[j])}.`,
          );
  }

  // 3. A small group can't fit together, though every smaller part of it can.
  if (reasons.length === 0) {
    const groups: Course[][] = [];
    let budget = 3000;
    for (let k = 3; k <= courses.length && groups.length === 0 && budget > 0; k++) {
      for (const combo of combinations(courses, k)) {
        if (--budget < 0) break;
        if (!isSolvable(combo, prefs)) groups.push(combo);
        if (groups.length >= 3) break;
      }
      for (const g of groups)
        reasons.push(
          `These ${g.length} courses can't all fit together, but any ${g.length - 1} of them can: ${listWords(g.map((c) => c.code))}.`,
        );
    }
  }

  if (reasons.length === 0)
    reasons.push("Your courses can't all be fitted together without a clash on your chosen days and times.");

  return { reasons, suggestions: suggest(courses, prefs, opts) };
}

/** Small changes that would make a routine possible. */
function suggest(courses: Course[], prefs: Preferences, opts: ExplainOptions): string[] {
  const out: string[] = [];

  const droppable = courses.filter((c) => courses.length > 1 && isSolvable(courses.filter((x) => x !== c), prefs));
  if (droppable.length)
    out.push(
      droppable.length === 1
        ? `Drop ${droppable[0].code} and the rest will fit.`
        : `Drop one of ${listWords(droppable.map((c) => c.code), "or")} and the rest will fit.`,
    );

  const extraDays = opts.allDays.filter((d) => !prefs.days.includes(d));
  const helpfulDays = extraDays.filter((d) => isSolvable(courses, { ...prefs, days: [...prefs.days, d] }));
  if (helpfulDays.length === 1) out.push(`Also tick ${helpfulDays[0]}.`);
  else if (helpfulDays.length > 1)
    out.push(`Also tick one of ${listWords(helpfulDays, "or")}.`);
  else {
    // Two-day classes (e.g. Sun & Wed) may need both days ticked at once.
    const pair = [...combinations(extraDays, 2)].find((p) => isSolvable(courses, { ...prefs, days: [...prefs.days, ...p] }));
    if (pair) out.push(`Also tick ${pair[0]} and ${pair[1]}.`);
  }

  const earlier = opts.startSlots.filter((t) => toMinutes(t) < toMinutes(prefs.start)).reverse();
  const start = earlier.find((t) => isSolvable(courses, { ...prefs, start: t }));
  if (start) out.push(`Start at ${start} instead of ${prefs.start}.`);

  const later = opts.endSlots.filter((t) => toMinutes(t) > toMinutes(prefs.end));
  const end = later.find((t) => isSolvable(courses, { ...prefs, end: t }));
  if (end) out.push(`Finish at ${end} instead of ${prefs.end}.`);

  if (out.length === 0) {
    const wide: Preferences = {
      days: opts.allDays,
      start: opts.startSlots[0],
      end: opts.endSlots[opts.endSlots.length - 1],
    };
    if (isSolvable(courses, wide))
      out.push("No single change is enough. Try ticking more days and widening your start and end times together.");
    else out.push("Even with every day and the whole day open, these courses can't fit together. You'll need to drop one.");
  }
  return out;
}
