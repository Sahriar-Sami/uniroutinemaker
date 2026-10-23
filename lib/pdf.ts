// Builds a printable PDF of one plan, in the browser.
// jsPDF is loaded only when the student presses "Download PDF".

import { isIfRequired, toMinutes } from "./solver";
import { alternativesText, COURSE_COLORS, formatGap, planLetter, sectionDays, sectionRooms, sectionTimes, shortDay, to12h } from "./format";
import type { Plan, Preferences } from "./types";

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

// The built-in PDF fonts can't draw "–", so use a plain hyphen.
const plain = (s: string) => s.replace(/[–—]/g, "-");

export async function downloadPlanPdf(
  plan: Plan,
  index: number,
  prefs: Preferences,
  slots: string[],
  source: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 12; // page margin
  const letter = planLetter(index);

  // --- header ---
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(27, 27, 31);
  doc.text(`Class Routine - Plan ${letter}`, M, 16);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100);
  doc.text(
    `Days: ${prefs.days.join(", ")}   |   Classes between ${to12h(prefs.start)} and ${to12h(prefs.end)}   |   ${plan.choices.length} course${plan.choices.length === 1 ? "" : "s"}   |   Gaps between classes: ${formatGap(plan.gapMinutes)}   |   Days at uni: ${plan.campusDays}`,
    M,
    22,
  );
  let top = 27;
  if (plan.usesIfRequired) {
    doc.setFillColor(255, 244, 214).roundedRect(M, top - 3.5, pageW - 2 * M, 6, 1, 1, "F");
    doc.setTextColor(140, 85, 0).setFont("helvetica", "bold");
    doc.text('This plan uses an "If required" section. It may only open if enough students need it.', M + 2, top + 0.5);
    top += 6;
  }

  // --- weekly timetable ---
  const labelW = 16;
  const gridX = M + labelW;
  const gridW = pageW - M - gridX;
  const headerH = 6;
  const gridTop = top + headerH;
  const gridH = 100;
  const from = toMinutes(prefs.start);
  const to = toMinutes(prefs.end);
  const y = (t: string) => gridTop + ((toMinutes(t) - from) / (to - from)) * gridH;
  const colW = gridW / prefs.days.length;

  doc.setDrawColor(210).setLineWidth(0.2);
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(90);
  prefs.days.forEach((d, i) => {
    doc.text(shortDay(d).toUpperCase(), gridX + colW * i + colW / 2, top + 4, { align: "center" });
    doc.line(gridX + colW * i, gridTop, gridX + colW * i, gridTop + gridH);
  });
  doc.line(gridX + gridW, gridTop, gridX + gridW, gridTop + gridH);
  doc.line(gridX, gridTop, gridX + gridW, gridTop);
  doc.line(gridX, gridTop + gridH, gridX + gridW, gridTop + gridH);

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(140);
  doc.setLineDashPattern([0.8, 0.8], 0);
  for (const s of slots) {
    if (toMinutes(s) < from || toMinutes(s) >= to) continue;
    doc.text(to12h(s), gridX - 1.5, y(s) + 1, { align: "right" });
    if (toMinutes(s) > from) doc.line(gridX, y(s), gridX + gridW, y(s));
  }
  doc.setLineDashPattern([], 0);

  plan.choices.forEach(({ course, section }, ci) => {
    const color = COURSE_COLORS[ci % COURSE_COLORS.length];
    for (const m of section.meetings) {
      const col = prefs.days.indexOf(m.day);
      if (col < 0) continue;
      const bx = gridX + colW * col + 0.6;
      const bw = colW - 1.2;
      const by = y(m.start) + 0.3;
      const bh = y(m.end) - y(m.start) - 0.6;
      doc.setFillColor(...rgb(color.bg)).rect(bx, by, bw, bh, "F");
      doc.setFillColor(...rgb(color.border)).rect(bx, by, 1, bh, "F");

      const lines: { text: string; bold?: boolean }[] = [
        { text: course.code, bold: true },
        ...doc.splitTextToSize(course.title, bw - 3).slice(0, 2).map((t: string) => ({ text: t })),
        { text: `Sec ${section.section}${isIfRequired(section) ? " (If required)" : ""}` },
        { text: `${m.start}-${m.end}  ${m.room}` },
      ];
      doc.setFontSize(6.5).setTextColor(...rgb(color.text));
      const lineH = 2.6;
      const maxLines = Math.max(1, Math.floor((bh - 1) / lineH));
      lines.slice(0, maxLines).forEach((l, li) => {
        doc.setFont("helvetica", l.bold ? "bold" : "normal");
        doc.text(l.text, bx + 2, by + 3 + li * lineH, { maxWidth: bw - 3 });
      });
    }
  });

  // --- course list ---
  autoTable(doc, {
    startY: gridTop + gridH + 6,
    margin: { left: M, right: M },
    head: [["Course code", "Course name", "Section", "Faculty", "Day", "Time", "Room"]],
    body: plan.choices.map(({ course, section, alternatives }) => [
      course.code,
      course.title,
      section.section + (isIfRequired(section) ? " (If required)" : ""),
      section.faculty + (alternatives.length ? `
Same time, other sections: ${alternativesText(alternatives)}` : ""),
      sectionDays(section),
      plain(sectionTimes(section)),
      sectionRooms(section),
    ]),
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.8, textColor: [27, 27, 31] },
    headStyles: { fillColor: [27, 27, 31], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 245, 241] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 24 }, 2: { cellWidth: 26 }, 4: { cellWidth: 22 } },
    didParseCell: (cell) => {
      if (cell.section === "body" && cell.column.index === 2 && String(cell.cell.raw).includes("If required")) {
        cell.cell.styles.textColor = [140, 85, 0];
        cell.cell.styles.fontStyle = "bold";
      }
    },
  });

  // --- footer on every page ---
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(150);
    doc.text(
      `Made with Uni Routine Maker  |  Source: ${source}  |  Always double-check with the official routine.`,
      M,
      doc.internal.pageSize.getHeight() - 6,
    );
  }

  doc.save(`routine-plan-${letter}.pdf`);
}
