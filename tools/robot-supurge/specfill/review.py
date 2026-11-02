# Toplanan ham arama dosyalarından aday değerleri kısa biçimde listeler (yalnızca başlık/URL'si modeli anan sonuçlar)
import json,subprocess,glob,os,re,sys
S=sys.argv[1]; only=set(sys.argv[2:])
G=json.load(open(S+'/spec_gaps.json'));d={o['id']:o for o in json.load(open(S+'/robots2.json'))['items']}
done=set(json.load(open(S+'/specfill/reviewed.json'))) if os.path.exists(S+'/specfill/reviewed.json') else set()
tmp=S+'/specfill/_f.json'
for f in sorted(glob.glob(S+'/specfill/raw/*.json')):
    k=os.path.basename(f)[:-5]
    if k not in G or (only and k not in only) or (not only and k in done): continue
    R=json.load(open(f)).get('results',[])
    key=[t for t in re.split(r'[^a-z0-9]+',re.sub(r'\(.*?\)','',d[k]['model']).lower()) if t]
    def ok(r):
        h=re.sub(r'[^a-z0-9]','',(r.get('title','')+' '+r['url']).lower())
        return all(t in h for t in key)
    keep=[r for r in R if ok(r)]
    json.dump({'results':keep},open(tmp,'w'))
    r=json.loads(subprocess.run(['python3','-I',S+'/specfill/extract.py',k,tmp]+G[k],capture_output=True,text=True).stdout)
    hits={fld:v for fld,v in r.items() if v['val'] is not None}
    if not hits: continue
    print('==',k,G[k])
    for fld,v in hits.items(): print('  ',fld,v['val'],'n',v['n'],v['srcs'][:2],v['alts'] or '','|',v['cands'][0][2][-110:])
