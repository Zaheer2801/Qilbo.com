import subprocess
import time

import subprocess
import time
import re

with open('migrate/v4_categories.sql') as f:
    text = f.read()

# Remove comment lines
clean_text = re.sub(r'--.*$', '', text, flags=re.MULTILINE)

# Split statements by semicolon
raw_stmts = [s.strip() for s in clean_text.split(';') if s.strip()]
# Filter out CREATE TABLE since it was already executed
stmts = [s for s in raw_stmts if not s.upper().startswith('CREATE TABLE')]

print(f"Total statements to execute on remote D1: {len(stmts)}")

BATCH_SIZE = 40
for i in range(0, len(stmts), BATCH_SIZE):
    batch = stmts[i:i + BATCH_SIZE]
    batch_sql = ";\n".join(batch) + ";"
    print(f"Executing batch {i // BATCH_SIZE + 1}/{(len(stmts) + BATCH_SIZE - 1) // BATCH_SIZE} ({len(batch)} statements)...")

    proc = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "discount-liquor", "--remote", "--command", batch_sql],
        capture_output=True,
        text=True
    )
    if proc.returncode != 0:
        print(f"Error executing batch {i // BATCH_SIZE + 1}:")
        print(proc.stderr or proc.stdout)
        raise RuntimeError("Failed executing batch")
    time.sleep(0.5)

print("\nAll batches successfully applied to remote D1!")
