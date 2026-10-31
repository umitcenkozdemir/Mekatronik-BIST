#!/usr/bin/env bash
# Veri zincirini baştan üretir. Kullanım: bash rebuild.sh "<stok kontrol zamanı>"
set -e
W="$(cd "$(dirname "$0")" && pwd)"; cd "$W"
WHEN="${1:-$(date '+%d.%m.%Y %H:%M')}"
RS_WORK="$W" python3 -I build.py
python3 -I build_rel.py "$W" >/dev/null
python3 -I attach_oos.py "$W" "$WHEN"
python3 -I enrich.py "$W"
python3 -I assemble.py "$W" "$W/../../public/robot-supurge/index.html"
