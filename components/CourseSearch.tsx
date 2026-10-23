"use client";

import { useMemo, useState } from "react";
import type { Course } from "@/lib/types";

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");

interface Props {
  courses: Course[];
  added: Course[];
  onAdd: (c: Course) => void;
  onRemove: (c: Course) => void;
}

export default function CourseSearch({ courses, added, onAdd, onRemove }: Props) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qn = normalize(q);
    return courses
      .filter((c) => normalize(c.code).includes(qn) || c.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, courses]);

  const isAdded = (c: Course) => added.some((a) => a.code === c.code);

  return (
    <div>
      <label htmlFor="course-search" className="sr-only">
        Search courses
      </label>
      <input
        id="course-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by code or title, e.g. CSE 2217 or Data Structure"
        autoComplete="off"
        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
      />

      {query.trim() && (
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {results.length === 0 && (
            <li className="px-4 py-3 text-sm text-stone-500">No course matches “{query.trim()}”.</li>
          )}
          {results.map((c) => {
            const done = isAdded(c);
            return (
              <li key={c.code} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{c.code}</div>
                  <div className="truncate text-sm text-stone-600">{c.title}</div>
                </div>
                <span className="hidden text-xs text-stone-400 sm:inline">{c.sections.length} sections</span>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => onAdd(c)}
                  className="shrink-0 rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:bg-stone-200 disabled:text-stone-500"
                >
                  {done ? "Added" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <div className="mb-2 text-sm font-medium text-stone-700">
          Your courses {added.length > 0 && <span className="text-stone-400">({added.length})</span>}
        </div>
        {added.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 px-4 py-4 text-sm text-stone-500">
            No courses yet. Search above and press Add.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {added.map((c) => (
              <li
                key={c.code}
                className="flex max-w-full items-center gap-2 rounded-full border border-stone-300 bg-white py-1 pl-3 pr-1 text-sm"
              >
                <span className="whitespace-nowrap font-semibold">{c.code}</span>
                <span className="min-w-0 max-w-[12rem] truncate text-stone-500">{c.title}</span>
                <button
                  type="button"
                  onClick={() => onRemove(c)}
                  aria-label={`Remove ${c.code}`}
                  className="rounded-full px-2 py-0.5 text-stone-500 hover:bg-red-50 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
