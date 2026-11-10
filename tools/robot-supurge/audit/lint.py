# Şüpheli özellik kombinasyonlarını listeler: python3 -I audit/lint.py <W>
import json,sys,re,collections
W=sys.argv[1]
d=[o for o in json.load(open(W+'/robots2.json'))['items'] if o['stock']!='yok' and o.get('ver')!='tek']
C=json.load(open(W+'/corrections.json'))
out=[]
def f(o,msg): out.append(f"{o['id']}: {msg}")
for o in d:
    n=o['name'].lower(); nav=o.get('nav'); obst=o.get('obst')
    if re.search(r'\b(ai|vision|cam|camera|reactive ?ai|aivi)\b',n) and obst in ('Tampon','Temel sensör'): f(o,f"adında AI/kamera var ama obst={obst}")
    if re.search(r'\b(omni|ultra|ultra\b)',n) and not o.get('mopWash') and o.get('mop') not in ('Yok',None): f(o,"Omni/Ultra adında mop yıkama yok")
    if re.search(r'(\bplus\b|\+)',n) and not o.get('selfEmpty'): f(o,"Plus/+ adında toz boşaltma yok")
    if (o.get('pa') or 0)>=8000 and nav in ('Rastgele','Jiroskop'): f(o,f"{o['pa']:.0f} Pa ama nav={nav}")
    if o.get('hotDry') and not o.get('mopWash'): f(o,"sıcak kurutma var ama mop yıkama yok")
    if o.get('hotWash') and not o.get('mopWash'): f(o,"sıcak yıkama var ama mop yıkama yok")
    if nav in ('Diğer',None): f(o,f"nav={nav} (sınıflandırılamamış)")
# aynı seri (marka + model gövdesi) içinde farklı nav/obst
key=lambda o:(o['brand'],re.sub(r'\s+(plus|\+|pro|max|ultra|omni|lite|se|ae|ce|s)\b.*$','',o['model'].lower()).strip())
G=collections.defaultdict(list)
for o in d: G[key(o)].append(o)
for k,g in G.items():
    navs={o.get('nav') for o in g}
    if len(g)>1 and len(navs)>1: out.append(f"SERİ {k[0]} {k[1]}: nav farklı → "+', '.join(f"{o['id']}={o.get('nav')}" for o in g))
import os
OK=json.load(open(W+'/audit/lint_ok.json')) if os.path.exists(W+'/audit/lint_ok.json') else {}
out=[l for l in out if l not in OK]  # kaynakla doğrulanmış istisnalar (satır -> açıklama)
print(len(out),'şüpheli satır');print('\n'.join(out))
