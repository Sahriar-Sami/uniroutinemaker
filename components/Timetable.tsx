import { toMinutes, isIfRequired } from "@/lib/solver";
import { COURSE_COLORS, shortDay, to12h } from "@/lib/format";
import type { Plan } from "@/lib/types";

const PX_PER_MIN = 1.4;

interface Props {
  plan: Plan;
  days: string[]; // columns, in week order
  start: string;
  end: string;
  slots: string[]; // time labels on the left
}

/** Weekly grid: days across, time down. */
export default function Timetable({ plan, days, start, end, slots }: Props) {
  const from = toMinutes(start);
  const to = toMinutes(end);
  const height = (to - from) * PX_PER_MIN;
  const y = (t: string) => (toMinutes(t) - from) * PX_PER_MIN;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[19rem]">
        {/* header */}
        <div className="flex border-b border-stone-200 pb-1 pl-11">
          {days.map((d) => (
            <div key={d} className="flex-1 text-center text-xs font-semibold uppercase tracking-wide text-stone-500">
              {shortDay(d)}
            </div>
          ))}
        </div>

        <div className="relative flex" style={{ height }}>
          {/* time labels + lines */}
          {slots
            .filter((s) => toMinutes(s) >= from && toMinutes(s) < to)
            .map((s) => (
              <div key={s} className="pointer-events-none absolute left-0 right-0" style={{ top: y(s) }}>
                <div className="w-11 -translate-y-1/2 whitespace-nowrap pr-1 text-right text-[9px] sm:text-[10px] text-stone-400">{to12h(s)}</div>
                <div className="absolute left-11 right-0 top-0 border-t border-dashed border-stone-200" />
              </div>
            ))}

          <div className="w-11 shrink-0" />
          {days.map((day) => (
            <div key={day} className="relative flex-1 border-l border-stone-200">
              {plan.choices.flatMap(({ course, section }, ci) =>
                section.meetings
                  .filter((m) => m.day === day)
                  .map((m, mi) => {
                    const color = COURSE_COLORS[ci % COURSE_COLORS.length];
                    return (
                      <div
                        key={`${course.code}-${mi}`}
                        className="absolute inset-x-0.5 overflow-hidden rounded-md border-l-4 px-1 py-1 text-[10px] leading-tight sm:px-1.5 sm:text-[11px]"
                        style={{
                          top: y(m.start),
                          height: y(m.end) - y(m.start),
                          background: color.bg,
                          borderColor: color.border,
                          color: color.text,
                        }}
                        title={`${course.code} ${course.title} — Sec ${section.section}, ${section.faculty}, ${to12h(m.start)}–${to12h(m.end)}, Room ${m.room || "—"}`}
                      >
                        <div className="font-semibold">{course.code}</div>
                        <div className="line-clamp-2 font-medium">{course.title}</div>
                        <div className="mt-0.5">
                          Sec {section.section}
                          {isIfRequired(section) && " (If req.)"}
                        </div>
                        <div className="opacity-80">
                          {m.start}–{m.end}
                        </div>
                        <div className="truncate opacity-80">{m.room}</div>
                      </div>
                    );
                  }),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
