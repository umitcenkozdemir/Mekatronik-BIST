# Bir grup model için: eksik alanlar, sonuç başlıkları (M=modeli anıyor) ve tüm sonuçlardan aday değerler.
import json,subprocess,re,sys
S=sys.argv[1]; ids=sys.argv[2:]
G=json.load(open(S+'/spec_gaps.json'));d={o['id']:o for o in json.load(open(S+'/robots2.json'))['items']}
for k in ids:
    try: R=json.load(open(f'{S}/specfill/raw/{k}.json')).get('results',[])
    except Exception: print('==',k,'HAM YOK'); continue
    key=[t for t in re.split(r'[^a-z0-9]+',re.sub(r'\(.*?\)','',d[k]['model']).lower()) if t]
    M=lambda r: all(t in re.sub(r'[^a-z0-9]','',(r.get('title','')+' '+r['url']).lower()) for t in key)
    print('==',k,G.get(k))
    for i,r in enumerate(R): print(f'  [{i}]{"M" if M(r) else " "}',r['url'].split('/')[2][:28],'|',r.get('title','')[:60])
    tmp=S+'/specfill/_f.json'
    for i,r in enumerate(R):
        json.dump({'results':[r]},open(tmp,'w'))
        o=json.loads(subprocess.run(['python3','-I',S+'/specfill/extract.py',k,tmp]+G.get(k,[]),capture_output=True,text=True).stdout or '{}')
        for f,v in o.items():
            for c in v['cands'][:2]: print(f'    [{i}] {f}={c[0]} ‥{c[2][-90:]}')
