# Satıştaki modellerde boş kalan özellik alanlarını en pahalıdan başlayarak spec_gaps.json'a yazar
import json,sys
S=sys.argv[1]
d=json.load(open(S+'/robots2.json'))['items']
live=sorted([o for o in d if o['stock']!='yok' and o.get('ver')!='tek'],key=lambda o:-o['price'])
G={}
for o in live:
    na=o.get('na',[])
    m=[f for f in ['pa','mah','rt','ch','db','dust','h','kg','climb'] if not o.get(f) and f not in na]
    if o['mop']!='Yok' and not o.get('water') and 'water' not in na: m.append('water')
    if (o['selfEmpty'] or o['selfEmptyOpt']) and not o['bagless'] and not o.get('stDust') and 'stDust' not in na: m.append('stDust')
    if o['mopWash']: m+=[f for f in ['stClean','stDirty'] if not o.get(f) and f not in na]
    if not o.get('sides') and 'sides' not in na: m.append('sides')
    if m: G[o['id']]=m
json.dump(G,open(S+'/spec_gaps.json','w'),ensure_ascii=False,indent=0)
print('eksik model',len(G),'boş alan',sum(len(v) for v in G.values()))
