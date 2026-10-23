// Checks data/courses.json for anything strange.
// Run with: npm run validate
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/courses.json", import.meta.url), "utf8"));

const VALID_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

const errors = [];
const warnings = [];

if (!Array.isArray(data.timeSlots) || data.timeSlots.length !== 6) {
  errors.push(`Expected 6 time slots, found ${data.timeSlots?.length}`);
}
for (const t of data.timeSlots ?? []) if (!TIME.test(t)) errors.push(`Bad time slot "${t}"`);
if (!Array.isArray(data.endSlots) || data.endSlots.length !== 6) {
  errors.push(`Expected 6 end slots, found ${data.endSlots?.length}`);
}
for (const [i, t] of (data.endSlots ?? []).entries()) {
  if (!TIME.test(t)) errors.push(`Bad end slot "${t}"`);
  else if (toMin(t) <= toMin(data.timeSlots[i])) errors.push(`End slot ${t} is not after start slot ${data.timeSlots[i]}`);
}

const codes = new Set();
let sectionCount = 0;
for (const c of data.courses) {
  if (codes.has(c.code)) errors.push(`Duplicate course code ${c.code}`);
  codes.add(c.code);
  if (!c.title) errors.push(`${c.code} has no title`);
  if (!c.sections?.length) errors.push(`${c.code} has no sections`);

  const names = new Set();
  for (const s of c.sections) {
    sectionCount++;
    const where = `${c.code} section ${s.section}`;
    if (names.has(s.section)) errors.push(`${where} appears twice`);
    names.add(s.section);
    if (!s.faculty) errors.push(`${where} has no faculty`);
    if (s.faculty === "TBA") warnings.push(`${where}: faculty is TBA`);
    if (!s.meetings?.length) errors.push(`${where} has no meetings`);

    for (const m of s.meetings ?? []) {
      if (!VALID_DAYS.includes(m.day)) errors.push(`${where}: invalid day "${m.day}"`);
      if (!TIME.test(m.start) || !TIME.test(m.end)) {
        errors.push(`${where}: bad time ${m.start}-${m.end}`);
        continue;
      }
      if (toMin(m.end) <= toMin(m.start)) errors.push(`${where}: end ${m.end} is not after start ${m.start}`);
      if (!m.room) warnings.push(`${where}: no room on ${m.day}`);
    }
    // a section should not clash with itself
    const ms = s.meetings ?? [];
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++)
        if (ms[i].day === ms[j].day && toMin(ms[i].start) < toMin(ms[j].end) && toMin(ms[j].start) < toMin(ms[i].end))
          errors.push(`${where}: its own meetings overlap on ${ms[i].day}`);
  }
}

console.log(`Courses: ${data.courses.length}, sections: ${sectionCount}`);
console.log(`Days: ${data.days.join(", ")}`);
console.log(`Time slots: ${data.timeSlots.join(", ")}`);
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ` + warnings.join("\n  "));
if (errors.length) {
  console.log(`\n${errors.length} ERROR(S):\n  ` + errors.join("\n  "));
  process.exit(1);
}
console.log("\nNo errors found.");
