# Uni Routine Maker

Pick the days you can come to uni, your time window and your courses. The app
builds up to 5 clash-free class routines, with the least free time between classes
first, and lets you download each one as a PDF.

Everything runs in the browser: no backend, no database, no login.

## Run it on your computer

```bash
npm install
npm run dev        # then open http://localhost:3000
```

Other commands:

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm test`         | Runs the solver tests                         |
| `npm run validate` | Checks `data/courses.json` for anything wrong |
| `npm run build`    | Production build (what Vercel runs)           |

## How it works

- `data/courses.json` holds every course, section, day, time, room and faculty.
  It is made from the university routine PDF and is the only data source.
- `lib/solver.ts` finds the plans (constraint satisfaction: pre-filter by days and
  times, backtracking with most-constrained-first and forward checking, ranked by
  least gap between classes; "If required" sections only after normal ones).
- `lib/explain.ts` explains why no routine fits and suggests what to change.
- `lib/pdf.ts` makes the PDF in the browser.
- `components/` holds the page.

## Updating the data for a new trimester

1. Put the new routine PDF somewhere on your computer.
2. Install the PDF reader once: `pip install pdfplumber`
3. Run:
   ```bash
   python scripts/parse_routine.py "path/to/New Routine.pdf"
   npm run validate
   npm test
   ```
   The script stops and lists any row it can't read, so nothing is guessed.
   If the new PDF has a different layout, the script may need small changes.
4. Commit and push. Vercel updates the live site automatically.
