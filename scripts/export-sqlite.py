"""Export a consistent SQLite snapshot for the one-time PostgreSQL migration.

Usage: python scripts/export-sqlite.py data/nungwi.sqlite backups/sqlite-import.json
The source is opened read-only. Treat the export as sensitive account data.
"""
import json
import sqlite3
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
destination = Path(sys.argv[2]).resolve()
if not source.is_file() or destination.exists():
    raise SystemExit("Source must exist and destination must be a new file.")
connection = sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)
snapshot = sqlite3.connect(":memory:")
try:
    connection.backup(snapshot)
    snapshot.row_factory = sqlite3.Row
    names = [r[0] for r in snapshot.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    records = {}
    for name in names:
        quoted = '"' + name.replace('"', '""') + '"'
        records[name] = [dict(row) for row in snapshot.execute("SELECT * FROM " + quoted)]
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("x", encoding="utf-8") as output:
        json.dump(records, output)
    print(f"Exported {sum(map(len, records.values()))} rows from {len(records)} tables.")
finally:
    snapshot.close()
    connection.close()
