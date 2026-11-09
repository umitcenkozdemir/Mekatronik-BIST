#!/usr/bin/env bash
# kaydet + sınıflandır + mevcut değerleri ve sıradaki 4 sorguyu bas
cd "$(dirname "$0")/.."
T=/root/.claude/projects/-home-user-Mekatronik-BIST/5d489f58-382e-58e4-9c80-64cc9ac36d80/tool-results
ids=$(python3 -I audit/save.py "$PWD" $T)
[ -n "$ids" ] && python3 -I audit/classify.py "$PWD" $ids
python3 - "$ids" <<'P'
import json,os,sys
d={o['id']:o for o in json.load(open('robots2.json'))['items']}
for i in sys.argv[1].split():
    o=d[i];print('  cur',i,[o.get(k) for k in ['nav','obst','mop','selfEmpty','mopWash','hotWash','hotDry']])
Q=json.load(open('audit/queue.json'));RC=json.load(open('audit/recheck.json'))
todo=[q for q in Q if not os.path.exists('audit/raw/'+q['id']+'.json') and q['id'] not in RC]
print('kalan',len(todo))
for q in todo[:4]: print(json.dumps([q['q'],q['dom']],ensure_ascii=False))
P
