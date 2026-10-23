"use client";

import { useRef, useState } from "react";
import CourseSearch from "./CourseSearch";
import PlanView from "./PlanView";
import { findPlans } from "@/lib/solver";
import { checkInputs, explainFailure, FAIL_MESSAGE } from "@/lib/explain";
import { formatGap, planLetter, to12h } from "@/lib/format";
import type { Course, CourseData, Plan, Preferences } from "@/lib/types";

type Result =
  | { kind: "plans"; plans: Plan[]; prefs: Preferences; key: string }
  | { kind: "fail"; reasons: string[]; suggestions: string[]; key: string };

const inputKey = (courses: Course[], prefs: Preferences) =>
  JSON.stringify([courses.map((c) => c.code), prefs]);

export default function RoutineBuilder({ data }: { data: CourseData }) {
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState(data.timeSlots[0]);
  const [end, setEnd] = useState(data.endSlots[data.endSlots.length - 1]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [active, setActive] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const prefs: Preferences = { days: data.days.filter((d) => days.includes(d)), start, end };
  const currentKey = inputKey(courses, prefs);

  const toggleDay = (d: string) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  function generate() {
    const missing = checkInputs(courses, prefs);
    if (missing.length) {
      setResult({ kind: "fail", reasons: missing, suggestions: [], key: currentKey });
    } else {
      const plans = findPlans(courses, prefs);
      if (plans.length) {
        setResult({ kind: "plans", plans, prefs, key: currentKey });
      } else {
        const ex = explainFailure(courses, prefs, {
          allDays: data.days,
          startSlots: data.timeSlots,
          endSlots: data.endSlots,
        });
        setResult({ kind: "fail", ...ex, key: currentKey });
      }
    }
    setActive(0);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const stale = result && result.key !== currentKey;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Uni Routine Maker</h1>
        <p className="mt-2 text-stone-600">
          Pick your days, your time window and your courses. We&apos;ll cook up to 5 clash-free routines.
        </p>
        <p className="mt-1 text-xs text-stone-400">Data: {data.source.replace(/\.pdf$/i, "")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* 1 + 2: days and times */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-bold">
            <span className="mr-2 text-stone-400">1</span>Days you can come
          </h2>
          <p className="mb-3 text-xs text-stone-500">Tap every day you&apos;re willing to come.</p>
          <div className="flex flex-wrap gap-2">
            {data.days.map((d) => {
              const on = days.includes(d);
              return (
                <label
                  key={d}
                  className={`cursor-pointer select-none rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600"
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleDay(d)} />
                  <span className="mr-1 inline-block w-3">{on ? "✓" : ""}</span>
                  {d}
                </label>
              );
            })}
          </div>

          <h2 className="mb-3 mt-6 font-bold">
            <span className="mr-2 text-stone-400">2</span>Your time window
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-stone-600">Earliest start</span>
              <select
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
              >
                {data.timeSlots.map((t) => (
                  <option key={t} value={t}>
                    {to12h(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-stone-600">Latest end</span>
              <select
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
              >
                {data.endSlots.map((t) => (
                  <option key={t} value={t}>
                    {to12h(t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-stone-500">Every class must start and finish inside this window.</p>
        </section>

        {/* 3: courses */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-bold">
            <span className="mr-2 text-stone-400">3</span>Your courses
          </h2>
          <CourseSearch
            courses={data.courses}
            added={courses}
            onAdd={(c) => setCourses((cs) => (cs.some((x) => x.code === c.code) ? cs : [...cs, c]))}
            onRemove={(c) => setCourses((cs) => cs.filter((x) => x.code !== c.code))}
          />
        </section>
      </div>

      <p className="mt-6 text-center text-sm text-stone-600">
        Looking for routines on{" "}
        <b>{prefs.days.length ? prefs.days.map((d) => d.slice(0, 3)).join(", ") : "no days yet"}</b> · classes between{" "}
        <b>{to12h(start)}</b> and <b>{to12h(end)}</b> · <b>{courses.length}</b> course{courses.length === 1 ? "" : "s"}
      </p>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={generate}
          className="w-full rounded-2xl bg-stone-900 px-8 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-stone-700 active:scale-[0.99] sm:w-auto"
        >
          Cook my routine
        </button>
      </div>

      <div ref={resultRef} className="scroll-mt-4 pt-8">
        {stale && (
          <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
            You changed something. Press <b>Cook my routine</b> again to update the plans.
          </p>
        )}

        {result?.kind === "fail" && (
          <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 sm:p-6">
            <h2 className="text-2xl font-black text-red-700">{FAIL_MESSAGE}</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-red-900">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {result.suggestions.length > 0 && (
              <>
                <h3 className="mt-5 font-bold text-stone-800">Things you could try</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
                  {result.suggestions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {result?.kind === "plans" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="mr-2 text-xl font-bold">
                {result.plans.length === 1 ? "1 plan found" : `${result.plans.length} plans found`}
              </h2>
              <div className="flex flex-wrap gap-1.5" role="tablist">
                {result.plans.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={active === i}
                    onClick={() => setActive(i)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      active === i ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-300"
                    }`}
                  >
                    Plan {planLetter(i)}
                    {p.usesIfRequired && <span className="ml-1 text-amber-500">*</span>}
                    <span className={`ml-1.5 text-xs font-normal ${active === i ? "text-stone-300" : "text-stone-500"}`}>
                      {p.gapMinutes === 0 ? "no gaps" : `${formatGap(p.gapMinutes)} gaps`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <p className="mb-2 text-xs text-stone-500">
              Sorted by least free time between classes (breaks of 20 min or less don&apos;t count).
            </p>
            {result.plans.some((p) => p.usesIfRequired) && (
              <p className="mb-3 text-xs text-stone-500">
                <span className="text-amber-500">*</span> uses an “If required” section
              </p>
            )}
            <PlanView
              plan={result.plans[active]}
              index={active}
              days={result.prefs.days}
              start={result.prefs.start}
              end={result.prefs.end}
              slots={data.timeSlots}
              source={data.source}
            />
          </div>
        )}
      </div>
    </main>
  );
}
