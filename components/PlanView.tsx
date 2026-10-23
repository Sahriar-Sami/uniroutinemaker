"use client";

import { useState } from "react";
import Timetable from "./Timetable";
import { isIfRequired } from "@/lib/solver";
import { alternativesText, COURSE_COLORS, formatGap, planLetter, sectionDays, sectionRooms, sectionTimes } from "@/lib/format";
import { downloadPlanPdf } from "@/lib/pdf";
import type { Plan } from "@/lib/types";

interface Props {
  plan: Plan;
  index: number;
  days: string[];
  start: string;
  end: string;
  slots: string[];
  source: string;
}

export function IfRequiredBadge() {
  return (
    <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
      If required
    </span>
  );
}

export default function PlanView({ plan, index, days, start, end, slots, source }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      await downloadPlanPdf(plan, index, { days, start, end }, slots, source);
    } catch {
      setError("Couldn't make the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Plan {planLetter(index)}</h3>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60"
        >
          {busy ? "Making PDF…" : "Download PDF"}
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-lg bg-emerald-50 px-3 py-1 text-emerald-800">
          Gaps between classes: <b>{formatGap(plan.gapMinutes)}</b>
        </span>
        <span className="rounded-lg bg-stone-100 px-3 py-1 text-stone-700">
          Days at uni: <b>{plan.campusDays}</b>
        </span>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {plan.usesIfRequired && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          This plan uses an <b>“If required”</b> section. It may only open if enough students need it.
        </p>
      )}

      <Timetable plan={plan} days={days} start={start} end={end} slots={slots} />

      {/* list view: cards on phones */}
      <ul className="mt-6 space-y-3 sm:hidden">
        {plan.choices.map(({ course, section, alternatives }, ci) => (
          <li
            key={course.code}
            className="rounded-xl border-l-4 bg-stone-50 px-3 py-2.5 text-sm"
            style={{ borderColor: COURSE_COLORS[ci % COURSE_COLORS.length].border }}
          >
            <div className="font-semibold">
              {course.code} · Sec {section.section}
              {isIfRequired(section) && <IfRequiredBadge />}
            </div>
            <div className="text-stone-500">{course.title}</div>
            <dl className="mt-1.5 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5">
              <dt className="text-stone-500">Faculty</dt>
              <dd>{section.faculty}</dd>
              <dt className="text-stone-500">Day</dt>
              <dd>{sectionDays(section)}</dd>
              <dt className="text-stone-500">Time</dt>
              <dd>{sectionTimes(section)}</dd>
              <dt className="text-stone-500">Room</dt>
              <dd>{sectionRooms(section)}</dd>
            </dl>
            {alternatives.length > 0 && (
              <p className="mt-1.5 text-xs text-stone-500">Same time, other sections: {alternativesText(alternatives)}</p>
            )}
          </li>
        ))}
      </ul>

      {/* list view: table on larger screens */}
      <div className="mt-6 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
              <th className="py-2 pr-3 font-semibold">Course</th>
              <th className="py-2 pr-3 font-semibold">Section</th>
              <th className="py-2 pr-3 font-semibold">Faculty</th>
              <th className="py-2 pr-3 font-semibold">Day</th>
              <th className="py-2 pr-3 font-semibold">Time</th>
              <th className="py-2 font-semibold">Room</th>
            </tr>
          </thead>
          <tbody>
            {plan.choices.map(({ course, section, alternatives }, ci) => (
              <tr key={course.code} className="border-b border-stone-100 align-top last:border-0">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ background: COURSE_COLORS[ci % COURSE_COLORS.length].border }}
                    />
                    <span className="font-semibold">{course.code}</span>
                  </div>
                  <div className="pl-5 text-stone-500">{course.title}</div>
                </td>
                <td className="py-2.5 pr-3 font-medium">
                  {section.section}
                  {isIfRequired(section) && <IfRequiredBadge />}
                </td>
                <td className="py-2.5 pr-3">
                  {section.faculty}
                  {alternatives.length > 0 && (
                    <div className="mt-1 max-w-[16rem] text-xs text-stone-500">
                      Same time, other sections: {alternativesText(alternatives)}
                    </div>
                  )}
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap">{sectionDays(section)}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap">{sectionTimes(section)}</td>
                <td className="py-2.5">{sectionRooms(section)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
