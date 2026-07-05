# BloomPro Studio — User Handbook (2026 Edition)

**Deliverable:** `BloomPro-Studio-User-Handbook-2026.pdf` (US Letter, 55 pages,
selectable text, clickable TOC, PDF bookmarks, real production screenshots).

## Editable source
- `handbook-part1.html` — design system (CSS) + cover, front matter, chapters 01–08
- `handbook-part2.html` — chapters 09–31
- `assets/` — application screenshots captured from production (test data, emails masked)

## Build (two-pass: TOC page numbers are measured, then re-rendered)
```
node docs/handbook/build.mjs            # pass 1 (renders cover.pdf + body.pdf)
python docs/handbook/postprocess.py merge
python docs/handbook/postprocess.py scan     # writes chapter-pages.json
node docs/handbook/build.mjs            # pass 2 (TOC numbers substituted)
python docs/handbook/postprocess.py merge
python docs/handbook/postprocess.py bookmarks
```
Requires Playwright (repo devDependency) and Python with `pypdf`.
