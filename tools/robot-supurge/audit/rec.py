# Bulgu kaydı: python3 audit/rec.py <id> alan=değer ... "kaynak"
import json,sys,os
S=os.path.dirname(os.path.abspath(__file__)); F=S+'/findings.json'
D=json.load(open(F)) if os.path.exists(F) else {}
i=sys.argv[1]; src=sys.argv[-1]; e=D.setdefault(i,{})
for kv in sys.argv[2:-1]:
    k,v=kv.split('=',1); e[k]={'true':True,'false':False}.get(v, float(v) if v.replace('.','',1).isdigit() else v)
e['src']=(e.get('src','')+'; ' if e.get('src') else '')+src
json.dump(D,open(F,'w'),ensure_ascii=False,indent=1); print(i,e)
