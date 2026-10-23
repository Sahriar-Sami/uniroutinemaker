import type { Section } from "./types";

/** "13:51" -> "1:51 PM" */
export function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const shortDay = (day: string) => day.slice(0, 3);

/** "Sun & Wed" */
export function sectionDays(s: Section): string {
  return s.meetings.map((m) => shortDay(m.day)).join(" & ");
}

/** "9:51 AM – 11:10 AM" when all meetings share a time, otherwise per day. */
export function sectionTimes(s: Section): string {
  const first = s.meetings[0];
  if (s.meetings.every((m) => m.start === first.start && m.end === first.end))
    return `${to12h(first.start)} – ${to12h(first.end)}`;
  return s.meetings.map((m) => `${shortDay(m.day)} ${to12h(m.start)} – ${to12h(m.end)}`).join(", ");
}

export function sectionRooms(s: Section): string {
  const rooms = [...new Set(s.meetings.map((m) => m.room).filter(Boolean))];
  return rooms.length ? rooms.join(", ") : "—";
}

/** 81 -> "1 h 21 min", 0 -> "No gaps" */
export function formatGap(min: number): string {
  if (min === 0) return "No gaps";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** "C (Name), D (Name)" — other sections at the same time. */
export function alternativesText(alts: Section[]): string {
  return alts.map((a) => `${a.section}${/if required/i.test(a.note ?? "") ? " [If required]" : ""} (${a.faculty})`).join(", ");
}

export const planLetter = (i: number) => String.fromCharCode(65 + i);

// One colour per course in a plan (background, border, text).
export const COURSE_COLORS = [
  { bg: "#e0ecff", border: "#3b6fd8", text: "#1d3f86" },
  { bg: "#ffe6d5", border: "#e0742b", text: "#8a3d0c" },
  { bg: "#dcf5e4", border: "#2f9e5a", text: "#17603a" },
  { bg: "#f4e1fb", border: "#a34fc9", text: "#62227f" },
  { bg: "#fff4c7", border: "#c99a0a", text: "#6e5300" },
  { bg: "#d8f3f6", border: "#1f9aac", text: "#0d5a66" },
  { bg: "#ffdfe4", border: "#d6445f", text: "#86172d" },
  { bg: "#e8e6dc", border: "#7d7659", text: "#46412c" },
];
