import json,re,glob,sys,urllib.parse
S=sys.argv[1]
R=json.load(open(S+'/robots.json'))['items']; byid={o['id']:o for o in R}
U=json.load(open(S+'/rate_urls.json'))
url2id={}
for i,u in zip(U['ids'],U['hb']): url2id[u]=i
for i,u in zip(U['ids'],U['am']): url2id[u]=i
ACC=re.compile(r'uyumlu|yedek|f[ıi]r[çc]a(?!s[ıi]z)|filtre|paspas|\bbez|torba|aparat|parça|batarya|\bpil\b|kılıf|sticker|koruyucu|rampa|hepa|mop pad|seti?\b|adet|\d+\s*(li|lı|lu|lü)\b|compatible|replacement|için',re.I)
SUFX=('pro','plus','max','ultra','mini','lite','omni','sonic','flow','complete','gen','+','s','e','c','l','v','x','t','d','r','a','i','2','3','4','5','6','7','8','9','0','1','prime','turbo','hybrid','combo','power','edge','curv','slim','aqua','heat','pet','roller')
def comp(s):
    s=s.lower().replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g').replace('ö','o').replace('ü','u').replace('+',' plus ')
    s=re.sub(r'\bq\s*revo','qrevo',s)
    return re.sub(r'[^a-z0-9]','',s)
def keyname(o):
    m=re.sub(r'\(.*?\)','',o['model'] or o['name'])
    m=re.sub(r'\b(robot|vacuum|süpürge)\b','',m,flags=re.I)
    return comp(m)
def cards(t,site):
    out=[]
    parts=re.split(r'\n\s*\*\s+\[!\[Image \d+: ',t)
    for p in parts[1:]:
        title=p.split('](')[0]
        if site=='hb':
            m=re.search(r'Ürün puanı ([\d.]+), (\d+) değerlendirme',p)
            rt,cnt=(float(m.group(1)),int(m.group(2))) if m else (None,0)
        else:
            m=re.search(r'([\d,]+)_5 yıldız üzerinden[^\(]*\(([\d.]+)\)',p)
            rt,cnt=(float(m.group(1).replace(',','.')),int(m.group(2).replace('.',''))) if m else (None,0)
        pr=re.findall(r'([\d]{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,6}(?:,\d{2})?) ?TL',p)
        price=float(pr[-1].replace('.','').replace(',','.')) if pr else None
        out.append(dict(title=title,rating=rt,count=cnt,price=price))
    return out
res={}
for site in ['hb','am']:
    for f in glob.glob(f'{S}/{site}/*.json'):
        d=json.load(open(f))
        for r in d.get('results',[]):
            i=url2id.get(r['url'])
            if not i: continue
            o=byid[i]; k=keyname(o); b=comp(o['brand'])
            best=None; acc=0; seen=[]
            for c in cards(r['raw_content'],site):
                ct=comp(c['title'])
                if k not in ct: continue
                if b not in ct and not ct.startswith(k): continue
                isacc=bool(ACC.search(c['title'])) or (c['price'] and c['price']<o['price']*0.25)
                if isacc: acc+=1; continue
                pos=ct.find(k); after=ct[pos+len(k):]
                if any(after.startswith(s) for s in SUFX if s not in ('robot',)) and not after.startswith(('robot','akilli','beyaz','siyah','supurge','istasyon','vacuum','cop','toz','ultracop','gri','mop','pasp','ve','ile','plus' if 'plus' in k else '§')): continue
                seen.append(c)
            if seen:
                cnt=sum(c['count'] for c in seen if c['rating'])
                w=sum(c['rating']*c['count'] for c in seen if c['rating'] and c['count'])
                best=dict(rating=round(w/cnt,2) if cnt else None,count=cnt,listings=len(seen),minPrice=min([c['price'] for c in seen if c['price']] or [None]) if any(c['price'] for c in seen) else None,titles=[c['title'][:90] for c in seen[:3]])
            res.setdefault(i,{})[site]=dict(match=best,acc=acc)
json.dump(res,open(S+'/ratings.json','w'),ensure_ascii=False,indent=0)
n=lambda s:sum(1 for v in res.values() if v.get(s,{}).get('match') and v[s]['match']['count'])
print('hb matched w/ reviews',n('hb'),'am',n('am'),'of',len(res))
