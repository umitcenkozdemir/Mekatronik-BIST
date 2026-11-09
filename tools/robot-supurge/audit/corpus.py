# Her model için epey dışı kaynak metni toplar: HB ürün sayfası (başlık+özellikler+açıklama)
import json,glob,os,sys,re
S=sys.argv[1]
d={o['id']:o for o in json.load(open(S+'/robots2.json'))['items'] if o['stock']!='yok' and o.get('ver')!='tek'}
url2id={}
for f in glob.glob(S+'/deep/*/research.json'):
    for k,v in json.load(open(f)).items():
        if k in d and v.get('hb') and v['hb'].get('url'): url2id.setdefault(v['hb']['url'].split('?')[0],k)
C={}
for f in glob.glob(S+'/deep/*/hb.json')+glob.glob(S+'/deep/hb*.json')+glob.glob(S+'/deep/hbprod*.json'):
    try: R=json.load(open(f))
    except Exception: continue
    R=R.get('results',R) if isinstance(R,dict) else R
    for r in (R if isinstance(R,list) else []):
        if not isinstance(r,dict): continue
        u=r.get('url','').split('?')[0]
        if u in url2id and r.get('raw_content'):
            t=r['raw_content']
            if len(t)>len(C.get(url2id[u],'')): C[url2id[u]]=t
json.dump(C,open(S+'/audit/hbtext.json','w'),ensure_ascii=False)
print('model',len(d),'HB metni olan',len(C),'olmayan',len([k for k in d if k not in C]))
