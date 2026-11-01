# specfill/*.json dosyalarındaki doğrulanmış özellik değerlerini corrections.json'a işler.
# Biçim: {model_id: {alan: değer, ..., "na": [yayımlanmamış alanlar], "specSrc": "kaynak"}}
import json,glob,os,sys
S=sys.argv[1] if len(sys.argv)>1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C=json.load(open(S+'/corrections.json'))
for f in sorted(glob.glob(S+'/specfill/b*.json')):
    for k,v in json.load(open(f)).items():
        c=C.setdefault(k,{})
        na=sorted(set(c.get('na',[]))|set(v.get('na',[])))
        c.update({a:b for a,b in v.items() if a!='na'})
        if na: c['na']=na
json.dump(C,open(S+'/corrections.json','w'),ensure_ascii=False,indent=1)
print('ok',len(C))
