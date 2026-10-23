import { describe, expect, it } from "vitest";
import { findPlans, sectionFits, sectionsClash, gapMinutes, MAX_PLANS } from "./solver";
import { explainFailure, checkInputs } from "./explain";
import type { Course, CourseData, Plan, Preferences, Section } from "./types";
import rawData from "../data/courses.json";

const data = rawData as CourseData;
const ALL_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"];
const opts = { allDays: ALL_DAYS, startSlots: data.timeSlots, endSlots: data.endSlots };
const fullWeek: Preferences = { days: ALL_DAYS, start: "08:30", end: "16:30" };

// --- helpers to build small made-up courses -------------------------------
function sec(name: string, slots: [string, string, string][], note?: string): Section {
  return {
    section: name,
    faculty: `Teacher ${name}`,
    facultyInitial: name,
    program: "BSCSE",
    meetings: slots.map(([day, start, end]) => ({ day, start, end, room: "101" })),
    ...(note ? { note } : {}),
  };
}
function course(code: string, sections: Section[]): Course {
  return { code, title: `${code} title`, credit: 3, programs: ["BSCSE"], sections };
}
const theory = (name: string, d1: string, d2: string, start: string, end: string, note?: string) =>
  sec(name, [[d1, start, end], [d2, start, end]], note);

/** Every plan must respect days/times, have no clashes, and plans must differ. */
function expectAllValid(plans: Plan[], prefs: Preferences) {
  for (const p of plans) {
    for (const { section } of p.choices) expect(sectionFits(section, prefs)).toBe(true);
    for (let i = 0; i < p.choices.length; i++)
      for (let j = i + 1; j < p.choices.length; j++)
        expect(sectionsClash(p.choices[i].section, p.choices[j].section)).toBe(false);
  }
  const keys = plans.map((p) => p.choices.map((c) => c.section.section).join("|"));
  expect(new Set(keys).size).toBe(plans.length);
}

// --- tests ----------------------------------------------------------------
describe("easy case", () => {
  const A = course("AAA 1001", [theory("A", "Saturday", "Tuesday", "08:30", "09:50"), theory("B", "Sunday", "Wednesday", "08:30", "09:50")]);
  const B = course("BBB 1001", [theory("A", "Saturday", "Tuesday", "08:30", "09:50"), theory("B", "Saturday", "Tuesday", "09:51", "11:10")]);

  it("finds clash-free plans that respect the days and times", () => {
    const plans = findPlans([A, B], fullWeek);
    // A-A/B-A clash; valid: A-A+B-B, A-B+B-A, A-B+B-B
    expect(plans.length).toBe(3);
    expectAllValid(plans, fullWeek);
  });

  it("only uses the days the student ticked", () => {
    const prefs = { ...fullWeek, days: ["Saturday", "Tuesday"] };
    const plans = findPlans([A, B], prefs);
    expect(plans.length).toBe(1);
    expect(plans[0].choices.map((c) => c.section.section)).toEqual(["A", "B"]);
  });
});

describe("stops at 5 plans", () => {
  it("never returns more than 5", () => {
    const many = (code: string) =>
      course(code, data.timeSlots.map((t, i) => theory(String(i), "Saturday", "Tuesday", t, data.endSlots[i])));
    const plans = findPlans([many("X 1"), many("Y 1")], fullWeek); // 6*5 = 30 possible
    expect(plans.length).toBe(MAX_PLANS);
    expectAllValid(plans, fullWeek);
  });
});

describe("time window (start + end dropdowns)", () => {
  const prefs: Preferences = { days: ALL_DAYS, start: "09:51", end: "13:50" };
  it("accepts classes fully inside the window and rejects the rest", () => {
    expect(sectionFits(theory("a", "Sunday", "Wednesday", "09:51", "11:10"), prefs)).toBe(true);
    expect(sectionFits(sec("lab", [["Monday", "11:11", "13:40"]]), prefs)).toBe(true);
    expect(sectionFits(theory("b", "Sunday", "Wednesday", "12:31", "13:50"), prefs)).toBe(true);
    expect(sectionFits(sec("early", [["Monday", "08:30", "11:00"]]), prefs)).toBe(false);
    expect(sectionFits(sec("late", [["Monday", "14:00", "16:30"]]), prefs)).toBe(false);
  });
});

describe("long once-a-week classes (labs etc.)", () => {
  it("a 2.5-hour lab clashes with a theory class that overlaps it", () => {
    const lab = sec("L", [["Sunday", "11:11", "13:40"]]);
    expect(sectionsClash(lab, theory("T", "Sunday", "Wednesday", "12:31", "13:50"))).toBe(true);
    expect(sectionsClash(lab, theory("T", "Sunday", "Wednesday", "13:51", "15:10"))).toBe(false);
    expect(sectionsClash(lab, theory("T", "Saturday", "Tuesday", "11:11", "12:30"))).toBe(false);
  });
});

describe("impossible case: a course has no section on the chosen days", () => {
  const onlyMonday = course("MON 2001", [sec("A", [["Monday", "08:30", "11:00"]])]);
  const prefs = { ...fullWeek, days: ["Saturday", "Sunday", "Tuesday", "Wednesday"] };

  it("finds no plan and says which course and why", () => {
    expect(findPlans([onlyMonday], prefs)).toEqual([]);
    const ex = explainFailure([onlyMonday], prefs, opts);
    expect(ex.reasons[0]).toContain("MON 2001");
    expect(ex.reasons[0]).toContain("has no section on your chosen days/times");
    expect(ex.reasons[0]).toContain("Mon 08:30–11:00");
    expect(ex.suggestions.join(" ")).toContain("Also tick Monday");
  });
});

describe("clash case: two courses always clash", () => {
  const A = course("AAA 1001", [theory("A", "Saturday", "Tuesday", "08:30", "09:50")]);
  const B = course("BBB 1001", [theory("A", "Saturday", "Tuesday", "08:30", "09:50"), theory("B", "Sunday", "Wednesday", "11:11", "12:30")]);

  it("names both courses", () => {
    const prefs = { ...fullWeek, days: ["Saturday", "Tuesday"] };
    expect(findPlans([A, B], prefs)).toEqual([]);
    const ex = explainFailure([A, B], prefs, opts);
    expect(ex.reasons).toHaveLength(1);
    expect(ex.reasons[0]).toMatch(/Every section of AAA 1001.*clashes with every section of BBB 1001/);
    expect(ex.suggestions.join(" ")).toContain("Also tick Sunday and Wednesday");
  });
});

describe("group case: 3 courses can't fit together but any 2 can", () => {
  const two = (code: string) =>
    course(code, [theory("A", "Saturday", "Tuesday", "08:30", "09:50"), theory("B", "Saturday", "Tuesday", "09:51", "11:10")]);
  const group = [two("AAA 1001"), two("BBB 1001"), two("CCC 1001")];

  it("finds the group and suggests a fix", () => {
    expect(findPlans(group, fullWeek)).toEqual([]);
    const ex = explainFailure(group, fullWeek, opts);
    expect(ex.reasons[0]).toBe("These 3 courses can't all fit together, but any 2 of them can: AAA 1001, BBB 1001 and CCC 1001.");
    expect(ex.suggestions[0]).toContain("Drop one of AAA 1001, BBB 1001 or CCC 1001");
  });
});

describe("'If required' sections", () => {
  const ifReq = "If required";
  it("puts plans without them first, and flags plans that use them", () => {
    const A = course("AAA 1001", [
      theory("A", "Saturday", "Tuesday", "08:30", "09:50"),
      theory("F", "Sunday", "Wednesday", "08:30", "09:50", ifReq),
    ]);
    const B = course("BBB 1001", [theory("A", "Saturday", "Tuesday", "09:51", "11:10")]);
    const plans = findPlans([A, B], fullWeek);
    expect(plans.map((p) => p.usesIfRequired)).toEqual([false, true]);
    expect(plans[1].choices[0].section.note).toBe(ifReq);
  });

  it("uses them when they are the only way", () => {
    const A = course("AAA 1001", [
      theory("A", "Saturday", "Tuesday", "08:30", "09:50"),
      theory("F", "Sunday", "Wednesday", "08:30", "09:50", ifReq),
    ]);
    const plans = findPlans([A], { ...fullWeek, days: ["Sunday", "Wednesday"] });
    expect(plans).toHaveLength(1);
    expect(plans[0].usesIfRequired).toBe(true);
  });
});

describe("missing inputs", () => {
  it("says what is missing", () => {
    expect(checkInputs([], { days: [], start: "08:30", end: "16:30" })).toEqual([
      "You haven't added any courses yet. Search for a course and press Add.",
      "You haven't picked any days. Tick at least one day you can come to uni.",
    ]);
    expect(checkInputs([course("X 1", [])], { days: ALL_DAYS, start: "12:31", end: "12:30" })[0]).toContain(
      "is not before your end time",
    );
  });
});

describe("real routine data", () => {
  const pick = (...codes: string[]) => codes.map((c) => data.courses.find((x) => x.code === c)!);

  it("builds valid plans for a typical 2nd-year load", () => {
    const courses = pick("CSE 2215", "CSE 2216", "CSE 2217", "CSE 2218", "MATH 2183");
    const prefs: Preferences = { days: ["Saturday", "Sunday", "Tuesday", "Wednesday"], start: "08:30", end: "15:10" };
    const plans = findPlans(courses, prefs);
    expect(plans.length).toBe(5);
    expectAllValid(plans, prefs);
  });

  it("explains a real impossible case", () => {
    // Labs never run before 08:30 or end before 11:00, so a 08:30–09:50 window can't fit one.
    const courses = pick("CSE 2216");
    const prefs: Preferences = { days: ALL_DAYS, start: "08:30", end: "09:50" };
    expect(findPlans(courses, prefs)).toEqual([]);
    const ex = explainFailure(courses, prefs, opts);
    expect(ex.reasons[0]).toContain("CSE 2216");
    expect(ex.suggestions.join(" ")).toContain("Finish at 11:10 instead of 09:50");
  });

  it("is fast even with many courses", () => {
    const courses = pick("CSE 2213", "CSE 2215", "CSE 2216", "CSE 2217", "CSE 2218", "CSE 3521", "CSE 3522", "EEE 2113");
    const t = Date.now();
    const plans = findPlans(courses, fullWeek);
    expectAllValid(plans, fullWeek);
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe("least gap first", () => {
  it("counts free time between classes, ignoring short breaks", () => {
    const a = theory("a", "Sunday", "Wednesday", "08:30", "09:50");
    const b = theory("b", "Sunday", "Wednesday", "09:51", "11:10"); // 1-min break: no gap
    const c = theory("c", "Sunday", "Wednesday", "12:31", "13:50"); // 81 min after b
    const lab = sec("lab", [["Sunday", "14:00", "16:30"]]); // 10 min after c: no gap
    expect(gapMinutes([a, b])).toBe(0);
    expect(gapMinutes([a, c])).toBe(2 * 161);
    expect(gapMinutes([a, b, c, lab])).toBe(2 * 81);
    expect(gapMinutes([a, sec("mon", [["Monday", "14:00", "16:30"]])])).toBe(0); // different days
  });

  it("puts the plan with the smallest gap first", () => {
    const A = course("AAA 1001", [theory("A", "Sunday", "Wednesday", "08:30", "09:50")]);
    const B = course("BBB 1001", [
      theory("far", "Sunday", "Wednesday", "15:11", "16:30"),
      theory("mid", "Sunday", "Wednesday", "12:31", "13:50"),
      theory("next", "Sunday", "Wednesday", "09:51", "11:10"),
    ]);
    const plans = findPlans([A, B], fullWeek);
    expect(plans.map((p) => p.choices[1].section.section)).toEqual(["next", "mid", "far"]);
    expect(plans.map((p) => p.gapMinutes)).toEqual([0, 2 * 161, 2 * 321]);
  });

  it("finds the true smallest gap on real data (checked against trying every combination)", () => {
    let seed = 99;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let t = 0; t < 300; t++) {
      const cs = [...data.courses].sort(() => rnd() - 0.5).slice(0, 2 + Math.floor(rnd() * 3));
      const prefs: Preferences = { days: ALL_DAYS.filter(() => rnd() < 0.8), start: "08:30", end: "16:30" };
      const doms = cs.map((c) => c.sections.filter((s) => sectionFits(s, prefs) && !s.note));
      let bestGap = Infinity;
      const go = (i: number, picked: Section[]) => {
        if (i === cs.length) return void (bestGap = Math.min(bestGap, gapMinutes(picked)));
        for (const s of doms[i]) if (picked.every((x) => !sectionsClash(x, s))) go(i + 1, [...picked, s]);
      };
      go(0, []);
      const plans = findPlans(cs, prefs).filter((p) => !p.usesIfRequired);
      if (bestGap === Infinity) expect(plans).toHaveLength(0);
      else {
        expect(plans[0].gapMinutes).toBe(bestGap);
        for (let i = 1; i < plans.length; i++) expect(plans[i].gapMinutes).toBeGreaterThanOrEqual(plans[i - 1].gapMinutes);
      }
    }
  });

  it("stays fast on a heavy load", () => {
    const heavy = ["CSE 2213", "CSE 2215", "CSE 2216", "CSE 2217", "CSE 2218", "CSE 3521", "CSE 3522"].map(
      (c) => data.courses.find((x) => x.code === c)!,
    );
    const t = Date.now();
    const plans = findPlans(heavy, fullWeek);
    const ms = Date.now() - t;
    console.log(`heavy load: ${ms} ms, best gap ${plans[0].gapMinutes} min`);
    expect(plans).toHaveLength(5);
    expect(ms).toBeLessThan(3000);
  });
});
