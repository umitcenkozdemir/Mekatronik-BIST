#!/usr/bin/env bash
# Veri zincirini baştan üretir. Kullanım: bash rebuild.sh "<stok kontrol zamanı>"
set -e
W="$(cd "$(dirname "$0")" && pwd)"; cd "$W"
WHEN="${1:-$(date '+%d.%m.%Y %H:%M')}"
BZ_WORK="$W" python3 -I build.py >/dev/null
python3 -I build_rel.py "$W" >/dev/null
python3 -I attach.py "$W" "$WHEN"
python3 -I enrich.py "$W"
mkdir -p "$W/../../public/buzdolabi"
python3 -I assemble.py "$W" "$W/../../public/buzdolabi/index.html"
