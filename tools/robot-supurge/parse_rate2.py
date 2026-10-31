import json,re,glob,sys
S=sys.argv[1]
R=json.load(open(S+'/robots.json'))['items']
ACC=re.compile(r'uyumlu|yedek|f[ıi]r[çc]a\b|f[ıi]r[çc]as[ıi]|filtre|paspas bez|mop bez|\bbez\b|torba|aparat|parça|parca|batarya|\bpil\b|kılıf|sticker|koruyucu|rampa|hepa|mop pad|\bset\b|seti\b|\badet\b|\d+\s*(li|lı|lu|lü)\b|compatible|replacement|için|adaptör|adaptor|kablo|şarj ünitesi|tekerlek|lastik|sensör',re.I)
STRIP=re.compile(r'robot|vacuum|cleanner|cleaner|s[üu]p[üu]rge(si)?|akıllı|akilli')
def comp(s):
    s=s.lower().replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g').replace('ö','o').replace('ü','u').replace('+',' plus ').replace('™','')
    s=re.sub(r'\bq\s*revo','qrevo',s); s=re.sub(r'\bxiaomi\s+mi\b','xiaomi',s); s=re.sub(r'^mi\s','',s)
    s=STRIP.sub(' ',s)
    return re.sub(r'[^a-z0-9]','',s)
def keyname(o):
    m=re.sub(r'\(.*?\)','',o['model'] or o['name']); return comp(m)
WL=('beyaz','siyah','gri','black','white','cop','istasyon','toz','mop','pasp','ve','ile','lazer','lds','lidar','otomatik','outlet','turkiye','tr','kamera','yapay','islak','kuru','wifi','haritala','sarj','cift','sicak','evcil','konusan','ozellik','moplu','premium','hepsi','garanti','resmi','distrib','2in1','emis','yuksek','moplu','gold','pembe','mavi','silver','gumus','koyu','acik','ai','homerun' )
def cards(t,site):
    out=[]
    parts=re.split(r'\n\s*\*\s+\[!\[Image \d+: ',t)[1:] if site=='hb' else re.split(r'\n## \[',t)[1:]
    for p in parts:
        title=p.split('](')[0].strip(); p=p[:2500]
        if site=='hb': m=re.search(r'Ürün puanı ([\d.]+), (\d+) değerlendirme',p); rt,cnt=(float(m.group(1)),int(m.group(2))) if m else (None,0)
        else:
            m=re.search(r'([\d,]+)\[_5 yıldız üzerinden.*?\[\((\d[\d.]*)\)\]',p); rt,cnt=(float(m.group(1).replace(',','.')),int(m.group(2).replace('.',''))) if m else (None,0)
        out.append(dict(title=title,rating=rt,count=cnt))
    return out
pool={'hb':{},'am':{}}
for site in pool:
    for f in glob.glob(f'{S}/{site}/*'):
        for r in json.load(open(f)).get('results',[]):
            for c in cards(r['raw_content'],site):
                if c['title']: pool[site][(c['title'],c['count'])]=c
res={}
for o in R:
    k=keyname(o); b=comp(o['brand'])
    if len(k)<2: res[o['id']]={};continue
    out={}
    for site,P in pool.items():
        seen={};acc=0
        for c in P.values():
            ct=comp(c['title']); 
            pos=ct.find(k)
            if pos<0: continue
            if ACC.search(c['title']):
                acc+=1; continue
            pre=ct[:pos]
            if not (pre=='' or pre.endswith(b) or pre in (b,'mi','xiaomi'+'mi')): continue
            if pre and not pre.endswith(b): continue
            after=ct[pos+len(k):]
            if after and not (after.startswith(WL) or re.match(r'\d[\d]{2,}(pa|mah)',after)): continue
            seen[(c['count'],c['rating'])]=c   # dedupe identical listings
        rated=[c for c in seen.values() if c['rating'] and c['count']]
        cnt=sum(c['count'] for c in rated)
        out[site]=dict(rating=round(sum(c['rating']*c['count'] for c in rated)/cnt,2) if cnt else None,count=cnt,listings=len(seen),acc=acc,
                       titles=[c['title'][:100] for c in sorted(seen.values(),key=lambda c:-c['count'])[:2]])
    res[o['id']]=out
json.dump(res,open(S+'/ratings.json','w'),ensure_ascii=False,indent=0)
hb=[i for i,v in res.items() if v and v['hb']['count']]; am=[i for i,v in res.items() if v and v['am']['count']]
print('pool',{k:len(v) for k,v in pool.items()},'hb rated',len(hb),'am rated',len(am),'either',len(set(hb)|set(am)))
if len(sys.argv)>2:
  for o in sorted(R,key=lambda o:-((res[o['id']] or {}).get('hb',{}).get('count',0)+(res[o['id']] or {}).get('am',{}).get('count',0)))[:int(sys.argv[2])]:
    v=res[o['id']]; print(o['name'][:32].ljust(32),'HB',v['hb']['rating'],v['hb']['count'],'| AM',v['am']['rating'],v['am']['count'],'|',(v['hb']['titles'] or v['am']['titles'] or [''])[0][:70])
