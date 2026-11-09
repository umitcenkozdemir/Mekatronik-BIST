# Resmi kaynak metninden puan alanlarını çıkarır ve robots2.json ile farkları basar
import json,re,sys,os
S=sys.argv[1]; ids=sys.argv[2:]
d={o['id']:o for o in json.load(open(S+'/robots2.json'))['items']}
R=[('nav','LiDAR',r'\blidar\b|\blds\b|laser distance|\bdtof\b|d-tof|starsight|laser navigation|precisense|lazer navigasyon|lazer mesafe|pathfinder|\blaser\b.*(navigat|map)'),
   ('nav','Kamera (vSLAM)',r'vslam|visual slam|camera[- ]based navigation|imprint.*map|vision navigation'),
   ('nav','Jiroskop',r'gyroscop|jiroskop'),
   ('obst','Yapay zekâ / kamera',r'\brgb\b|ai camera|reactiveai|reactive ai|aivi|precisionvision|camera.*(obstacle|recogni|avoid)|(obstacle|recogni|avoid).*camera|kamera|ai (recogni|identif)|recogni[sz]es? (over |up to )?\d+\+? (types of )?(obstacles|objects)|\d+\+? (types of )?(obstacles|objects) (recogni|identif)'),
   ('obst','3D / yapısal ışık',r'structured light|3d obstacle|line laser|reactive 3d|3d sensing|3d structured|tof sensor|yapısal ışık'),
   ('mop','Rulo mop',r'(?<!duo)roller mop|ozmo roller|mop roller|aquamop|roller mopping|rulo mop|roller-mop|self-cleaning roller|crawler'),
   ('mop','Çift döner',r'rotating mop|spinning mop|dual[- ](rotating|spinning)|rotary mop|döner mop|twin spinning|spinning pads|pads? .{0,20}spinning|spinning .{0,15}pads'),
   ('mop','Titreşimli',r'vibrarise|sonic mop|vibrat|titreşim'),
   ('se',True,r'auto[- ]?empty|self[- ]?empty|dust emptying|automatic dust|dust collection|toz boşaltma'),
   ('mw',True,r'mop wash|mop[- ]washing|washes the mop|self[- ]clean(s|ing)? (the )?mops?|mop (self-)?cleaning|paspas yıkama'),
   ('hw',True,r'hot water|°c water|℃ water|°f water|℉ water|sıcak su'),
   ('hd',True,r'hot air|warm air|heated (air )?dry|hot-air|sıcak hava')]
CUR=lambda o:dict(nav=o['nav'],obst=o['obst'],mop=o['mop'],se=o['selfEmpty'],mw=o['mopWash'],hw=o['hotWash'],hd=o['hotDry'])
RANK={'nav':['LiDAR','Kamera (vSLAM)','Jiroskop'],'obst':['Yapay zekâ / kamera','3D / yapısal ışık'],'mop':['Rulo mop','Çift döner','Titreşimli']}
for i in ids:
    f=S+'/audit/raw/'+i+'.json'
    if not os.path.exists(f): print('##',i,'KAYNAK YOK'); continue
    J=json.load(open(f)); res=J.get('results',[])
    slug=re.sub(r'^[a-z]+-','',i)  # marka önekini at
    def rel(u):
        u=u.lower().replace('_','-')
        return slug in u or i in u
    R2=[r for r in res if rel(r.get('url',''))]
    note='' if R2 or res and res[0].get('url')=='manual' else ' (MODELE ÖZEL SAYFA YOK)'
    if R2: res=R2
    o=d[i]; cur=CUR(o); found={}; ev={}
    for r in res:
        t=(r.get('raw_content') or r.get('content') or '')
        for l in re.split(r'\n+',t):
            if re.match(r'^[ \t]{3,}\S',l): continue  # girintili site menüsü satırı
            ll=l.lower()
            if len(ll)>400 or ll.count('|')>=3 or '](/' in ll or '](http' in ll: continue  # karşılaştırma tablosu satırlarını atla
            for k,v,p in R:
                if re.search(p,ll):
                    found.setdefault(k,[]); 
                    if v not in found[k]: found[k].append(v); ev[(k,v)]=(l.strip()[:150],r['url'][:70])
    pa=sorted({int(x.replace(',','').replace('.','')) for x in re.findall(r'(\d{1,2}[,.]?\d{3})\s?pa\b',' '.join((r.get('raw_content') or '').lower() for r in res))})
    mah=sorted({int(x.replace(',','').replace('.','')) for x in re.findall(r'(\d{1,2}[,.]?\d{3})\s?mah',' '.join((r.get('raw_content') or '').lower() for r in res))})
    diffs=[]
    for k in ['nav','obst','mop']:
        if k in found:
            best=[v for v in RANK[k] if v in found[k]][0]
            if k=='mop' and best!=cur[k] or k!='mop' and RANK[k].index(best)<(RANK[k].index(cur[k]) if cur[k] in RANK[k] else 99): diffs.append(f"{k}: {cur[k]} → {best} [{ev[(k,best)][0]}]")
    for k in ['se','mw','hw','hd']:
        if found.get(k) and not cur[k]: diffs.append(f"{k}: yok → var [{ev[(k,True)][0]}]")
    urls=[r['url'][:60] for r in res]
    print('##',i+note,o['price'],'| pa',o.get('pa'),pa[-4:],'| mah',o.get('mah'),mah[-3:],'|',urls[:2])
    for x in diffs: print('   ',x)
