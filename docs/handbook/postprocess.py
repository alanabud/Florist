"""Find chapter start pages (for the TOC) and add PDF bookmarks."""
import json, sys, os
from pypdf import PdfReader, PdfWriter

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "BloomPro-Studio-User-Handbook-2026.pdf")

CHAPTERS = [
    ("ch01", "GETTING STARTED"), ("ch02", "UNDERSTANDING THE DASHBOARD"),
    ("ch03", "CUSTOMERS"), ("ch04", "PRODUCTS"), ("ch05", "INVENTORY"),
    ("ch06", "ORDERS"), ("ch07", "THE ORDER LIFECYCLE"),
    ("ch08", "BACKORDERS & PRODUCT SHORTAGES"), ("ch09", "DESIGNER & PRODUCTION WORKFLOW"),
    ("ch10", "READY & DELIVERY OPERATIONS"), ("ch11", "PAYMENTS & ACCOUNTS RECEIVABLE"),
    ("ch12", "CUSTOMER STATEMENTS"), ("ch13", "PURCHASING & VENDORS"),
    ("ch14", "RECEIVING INVENTORY"), ("ch15", "INVENTORY COSTING: WAC, COGS & MARGIN"),
    ("ch16", "INVENTORY ADJUSTMENTS & SPOILAGE"), ("ch17", "FINANCE & GENERAL LEDGER"),
    ("ch18", "RECONCILIATION"), ("ch19", "REPORTS & EXPORTS"),
    ("ch20", "EVENTS & QUICK ACTIONS"), ("ch21", "BRANCH OPERATIONS"),
    ("ch22", "USERS, ROLES & PERMISSIONS"), ("ch23", "MULTI-COMPANY OPERATIONS"),
    ("ch24", "COMPANY SETTINGS"), ("ch25", "LANGUAGES & LOCALIZATION"),
    ("ch26", "NOTIFICATIONS"), ("ch27", "COMMON DAILY WORKFLOWS"),
    ("ch28", "TROUBLESHOOTING"), ("ch29", "BEST PRACTICES"),
    ("ch30", "GLOSSARY"), ("ch31", "QUICK REFERENCE"),
]
FRONT = [("Welcome to BloomPro Studio", "WELCOME TO BLOOMPRO STUDIO"),
         ("How to Use This Handbook", "HOW TO USE THIS HANDBOOK"),
         ("Table of Contents", "TABLE OF CONTENTS")]

import re
mode = sys.argv[1] if len(sys.argv) > 1 else "scan"

if mode == "merge":
    w = PdfWriter()
    w.append(PdfReader(os.path.join(HERE, "cover.pdf")))
    w.append(PdfReader(os.path.join(HERE, "body.pdf")))
    with open(PDF, "wb") as f:
        w.write(f)
    print(f"merged: {len(PdfReader(PDF).pages)} pages")
    sys.exit(0)

reader = PdfReader(PDF)
def norm(s):  # extraction-insensitive: keep only A-Z0-9
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())
texts = [norm(p.extract_text()) for p in reader.pages]

def find(needle, start=0):
    n = norm(needle)
    for i in range(start, len(texts)):
        if n in texts[i]:
            return i
    return None
pages = {}
# Chapter titles also appear as TOC rows — start scanning AFTER the TOC page.
toc_idx = find("TABLE OF CONTENTS") or 0
cursor = toc_idx + 1
for cid, title in CHAPTERS:
    idx = find(title.upper(), cursor)
    if idx is None:
        print(f"!! not found: {title}")
        continue
    pages[cid] = idx + 1  # 1-based, matches footer pageNumber
    cursor = idx + 1  # a chapter never starts on the previous chapter's opening page

if mode == "scan":
    with open(os.path.join(HERE, "chapter-pages.json"), "w") as f:
        json.dump(pages, f, indent=1)
    print(f"pages: {len(reader.pages)} · chapters found: {len(pages)}/{len(CHAPTERS)}")
    print(json.dumps(pages))
else:  # bookmarks
    writer = PdfWriter()
    writer.append(reader)
    writer.add_outline_item("Cover", 0)
    for label, needle in FRONT:
        i = find(needle)
        if i is not None:
            writer.add_outline_item(label, i)
    for n, (cid, title) in enumerate(CHAPTERS, 1):
        if cid in pages:
            writer.add_outline_item(f"{n:02d} — {title.title()}", pages[cid] - 1)
    meta = {"/Title": "BloomPro Studio — User Handbook (2026 Edition)",
            "/Author": "AF Strategic Technologies LLC",
            "/Subject": "Your Complete Guide to Running Daily Florist Operations"}
    writer.add_metadata(meta)
    with open(PDF, "wb") as f:
        writer.write(f)
    print(f"bookmarks added: {len(pages)+1+len(FRONT)} · total pages {len(reader.pages)}")
