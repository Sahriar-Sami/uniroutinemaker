"""
Convert the university routine PDF into data/courses.json.

Usage (from the uni-routine-maker folder):
    pip install pdfplumber
    python scripts/parse_routine.py "../Class Routine with faculty assign Fall 2026.pdf"

How it works:
  Some cells in the PDF contain text that is longer than the cell, so it spills
  into the next column (e.g. long faculty names). Reading table cells directly
  mixes those letters up. Instead we read each row's characters in the order the
  PDF draws them, join them into one line, and parse that line with one strict
  pattern. Any row that does not match stops the script so nothing is guessed.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber

DAY_NAMES = {"Sat": "Saturday", "Sun": "Sunday", "Mon": "Monday", "Tue": "Tuesday",
             "Wed": "Wednesday", "Thu": "Thursday", "Fri": "Friday"}
DAY_ORDER = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

D = r"(?:Sat|Sun|Mon|Tue|Wed|Thu|Fri)"
T = r"\d\d:\d\d:[AP]M - \d\d:\d\d:[AP]M"
ROOM = r"\d{3,4}[A-Z]?(?: \([A-Za-z ]+ Lab\))?"
ROW = re.compile(
    rf"^(\d+) (BSCSE|BSDS) ([A-Z]{{2,4}} \d{{4}}[A-Z]?) (.+?)(?: |(?<=[a-z]))"
    rf"([A-Z]{{1,2}})(?: \(([Ii]f [Rr]equired)\))?(?: ({ROOM}))?(?: ({ROOM}))? "
    rf"({D})(?: ({D}))? ({T})(?: ({T})| -)(?: (.+))? (\d)$"
)


def row_texts(pdf_path):
    """Yield (page, text runs of the 'Faculty Initial' column, full row text)."""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.find_tables()
            if not tables:
                continue
            table = tables[0]
            col_x = [c[0] for c in table.rows[0].cells]
            initial_col = 12
            for row in table.rows[1:]:
                top, bottom = row.bbox[1], row.bbox[3]
                chars = [c for c in page.chars if top <= (c["top"] + c["bottom"]) / 2 <= bottom]
                runs, cur = [], []
                for c in chars:  # PDF drawing order
                    if cur:
                        prev = cur[-1]
                        gap = c["x0"] - prev["x1"]
                        if (abs(c["top"] - prev["top"]) > 2 or gap < -1
                                or (gap > 1.2 and prev["text"] != " " and c["text"] != " ")):
                            runs.append(cur)
                            cur = []
                    cur.append(c)
                if cur:
                    runs.append(cur)
                pieces, initials = [], []
                for r in runs:
                    txt = "".join(ch["text"] for ch in r).strip()
                    if not txt:
                        continue
                    pieces.append(txt)
                    col = max(j for j, x in enumerate(col_x) if x <= r[0]["x0"] + 0.5)
                    if col == initial_col:
                        initials.append(txt)
                yield page.page_number, initials, re.sub(r"\s+", " ", " ".join(pieces)).strip()


def to24(t):
    hh, mm, ap = re.fullmatch(r"(\d\d):(\d\d):([AP]M)", t).groups()
    h = int(hh) % 12 + (12 if ap == "PM" else 0)
    return f"{h:02d}:{mm}"


def split_time(rng):
    a, b = rng.split(" - ")
    return to24(a), to24(b)


def split_faculty(tail, initials):
    """Separate the faculty name from the initial that follows it."""
    tail = (tail or "").strip()
    ini = initials[-1] if initials else ""
    if ini and tail == ini:
        return tail, ini
    if ini and tail.endswith(" " + ini):
        return tail[: -len(ini) - 1].strip(), ini
    return tail, ""


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else "../Class Routine with faculty assign Fall 2026.pdf"
    out_path = Path(__file__).resolve().parent.parent / "data" / "courses.json"

    rows, bad = [], []
    for page, initials, text in row_texts(pdf_path):
        m = ROW.match(text)
        if not m:
            bad.append(f"page {page}: {text}")
            continue
        sl, prog, code, title, sec, ifreq, r1, r2, d1, d2, t1, t2, tail, credit = m.groups()
        fac, ini = split_faculty(tail, initials)
        rows.append(dict(sl=int(sl), program=prog, code=code, title=title.strip(), section=sec,
                         ifRequired=bool(ifreq), room1=r1, room2=r2, day1=d1, day2=d2,
                         time1=t1, time2=t2, faculty=fac, initial=ini, credit=int(credit)))
    if bad:
        print("Could not read these rows:\n  " + "\n  ".join(bad))
        sys.exit(1)

    # Fix names whose initial got glued on without a space ("Name NameME" or "NameME"),
    # using the same name as written correctly elsewhere in the routine.
    known = Counter(r["faculty"] for r in rows if r["initial"])
    for r in rows:
        if r["initial"] or not r["faculty"]:
            continue
        f = r["faculty"]
        half = len(f) // 2
        if len(f) % 2 == 0 and f[:half] == f[half:]:
            r["faculty"] = r["initial"] = f[:half]
            continue
        for name in sorted(known, key=len, reverse=True):
            if f != name and f.startswith(name) and len(f) - len(name) <= 6:
                r["faculty"], r["initial"] = name, f[len(name):].strip()
                break
        else:
            glued = re.fullmatch(r"(.*[a-z])([A-Z]{2,6})", f)  # e.g. "ElahiME"
            if glued:
                r["faculty"], r["initial"] = glued.group(1), glued.group(2)
    for r in rows:
        if not r["faculty"]:
            r["faculty"] = "TBA"

    courses = {}
    for r in rows:
        c = courses.setdefault(r["code"], {"code": r["code"], "title": r["title"],
                                           "credit": r["credit"], "programs": [], "sections": []})
        if r["program"] not in c["programs"]:
            c["programs"].append(r["program"])
        meetings = []
        for day, rng, room in ((r["day1"], r["time1"], r["room1"]),
                               (r["day2"], r["time2"] or r["time1"], r["room2"] or r["room1"])):
            if not day:
                continue
            start, end = split_time(rng)
            meetings.append({"day": DAY_NAMES[day], "start": start, "end": end, "room": room or ""})
        sec = {"section": r["section"], "faculty": r["faculty"], "facultyInitial": r["initial"],
               "program": r["program"], "meetings": meetings}
        if r["ifRequired"]:
            sec["note"] = "If required"
        c["sections"].append(sec)

    starts = Counter(m["start"] for c in courses.values() for s in c["sections"] for m in s["meetings"])
    days = sorted({m["day"] for c in courses.values() for s in c["sections"] for m in s["meetings"]},
                  key=DAY_ORDER.index)
    data = {
        "source": Path(pdf_path).name,
        "days": days,
        "timeSlots": [],  # filled in below
        "endSlots": [],
        "courses": sorted(courses.values(), key=lambda c: c["code"]),
    }
    # The 6 official class start times = start times used by two-day (theory) classes.
    theory_starts = sorted({m["start"] for c in courses.values() for s in c["sections"]
                            if len(s["meetings"]) == 2 for m in s["meetings"]})
    data["timeSlots"] = theory_starts
    # Matching end times of those 6 slots, used for the "End time" dropdown.
    data["endSlots"] = sorted({m["end"] for c in courses.values() for s in c["sections"]
                               if len(s["meetings"]) == 2 for m in s["meetings"]})

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out_path} ({len(rows)} rows, {len(courses)} courses)")
    print("All start times seen:", dict(sorted(starts.items())))


if __name__ == "__main__":
    main()
