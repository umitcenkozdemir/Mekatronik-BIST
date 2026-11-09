# findings.json → corrections.json (alanları uygular, kaynağı src'ye ekler)
import json,sys,os
S=sys.argv[1]; D=os.path.dirname(os.path.abspath(__file__))
F=json.load(open(D+'/findings.json')); C=json.load(open(S+'/corrections.json'))
n=0
for i,e in F.items():
    c=C.setdefault(i,{})
    for k,v in e.items():
        if k=='src': continue
        if c.get(k)!=v: c[k]=v; n+=1
    tag='Resmi kaynak denetimi (9 Kasım 2026): '+e['src']
    if tag not in c.get('src',''): c['src']=(c['src']+'; ' if c.get('src') else '')+tag
json.dump(C,open(S+'/corrections.json','w'),ensure_ascii=False,indent=1)
print('model',len(F),'alan değişikliği',n)
