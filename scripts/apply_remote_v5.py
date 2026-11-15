import subprocess
import time
import re

with open('migrate/v5_fix_lottery_and_xxl.sql') as f:
    text = f.read()

clean_text = re.sub(r'--.*$', '', text, flags=re.MULTILINE)
raw_stmts = [s.strip() for s in clean_text.split(';') if s.strip()]

print(f"Total statements to execute on remote D1: {len(raw_stmts)}")

for i, s in enumerate(raw_stmts, 1):
    sql = s + ";"
    print(f"[{i}/{len(raw_stmts)}] Executing: {sql[:60]}...")
    proc = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "discount-liquor", "--remote", f"--command={sql}"],
        capture_output=True,
        text=True
    )
    if proc.returncode != 0:
        print(f"❌ Error on statement {i}:")
        print(proc.stderr or proc.stdout)
        raise RuntimeError(f"Failed executing statement {i}")
    time.sleep(0.3)

print("\n✅ All 22 migration statements successfully executed on remote D1!")
