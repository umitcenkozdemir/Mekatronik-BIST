import json,re,glob,sys
S=sys.argv[1]
brands={};cats={}
def setk(d,k,v):
    if v is not None and d.get(k) is None: d[k]=v
def I(x): return int(x.replace('.','')) if x else None
for f in sorted(glob.glob(S+'/sv/*')):
    try: d=json.load(open(f))
    except: continue
    for r in d.get('results',[]):
        u=r['url'].rstrip('/'); t=re.sub(r'\]\([^)]*\)',']',r['raw_content'])
        m=re.match(r'https://www\.sikayetvar\.com/([^/?]+)(?:/([^/?]+))?(?:\?page=(\d+))?$',u)
        if not m: continue
        slug,cat,page=m.groups()
        if 'Böyle bir sayfa bulamadık' in t: continue
        if cat is None:
            b=brands.setdefault(slug,{})
            mm=re.search(r'\n# ([^\n]+)\s+(\d+)/100\s+\(([\d.]+) değerlendirme\)',t)
            if mm: setk(b,'name',mm.group(1)); setk(b,'score',int(mm.group(2))); setk(b,'ratings',I(mm.group(3)))
            mm=re.search(r'\n# ([^\n]+)\n',t); setk(b,'name',mm.group(1).strip() if mm else None)
            mm=re.search(r'\n\s*([\d.]+) şikayet\s*\n',t); setk(b,'complaints',I(mm.group(1)) if mm else None)
            mm=re.search(r'Robot Süpürge ?([\d.]+)\]',t); setk(b,'robotComplaints',I(mm.group(1)) if mm else None)
            mm=re.search(r'cevaplama oranı\**\s*%(\d+)',t); setk(b,'responseRate',int(mm.group(1)) if mm else None)
            mm=re.search(r'([\d+]+ yıldır|\*\*[^*]+\*\*)\s*Şikayetvar pro üye',t); setk(b,'pro',re.sub(r'\*','',mm.group(1)) if mm else None)
            mm=re.search(r'Marka Karnesi\n+(.*?)\n',t)
            if mm and len(mm.group(1))>60: setk(b,'aiSummary',re.sub(r'\*\*','',mm.group(1)).strip())
            mm=re.search(r'(\d+)/100\s*\n+\s*Çözüm Başarısı',t); setk(b,'satisfaction',int(mm.group(1)) if mm else None)
            mm=re.search(r'Yanıt Oranı\((\d+)/(\d+)\)',t)
            if mm: setk(b,'answered',[int(mm.group(1)),int(mm.group(2))])
            mm=re.search(r'([\d.]+)\s*Çözülen Şikayet',t); setk(b,'solved',I(mm.group(1)) if mm else None)
            mm=re.search(r'(\d+)\s*sa\s*Ortalama Yanıt Süresi',t); setk(b,'respHours',int(mm.group(1)) if mm else None)
            mm=re.search(r'garanti süresi (\d+) yıl',t); setk(b,'warrantyFaq',int(mm.group(1)) if mm else None)
        elif cat=='robot-supurge':
            c=cats.setdefault(slug,{'complaints':None,'topics':[],'items':[],'models':[],'heading':None})
            mm=re.search(r'\n# ([^\n]+)',t); setk(c,'heading',mm.group(1).strip() if mm else None)
            mm=re.search(r'\n## ([\d.]+) şikayet\s*\n',t)
            if mm: setk(c,'complaints',I(mm.group(1)))
            mm=re.search(r'Öne Çıkan\s*Konular\s*\n\s*(.*?)\n',t)
            if mm and not c['topics']:
                c['topics']=[re.sub(r'\*\*','',x).strip() for x in re.findall(r'\[([^\]]+)\]',mm.group(1))]
            for mm in re.finditer(r'\n### \[([^\]]+)\][^\n]*\n(.*?)(?=\n### |\n## |\Z)',t,re.S):
                title=mm.group(1).strip(); body=mm.group(2)
                tag=[x for x in re.findall(r'\[#([^\]]+)\]',body) if x!='Robot Süpürge']
                date=re.search(r'\n(\d{1,2} [A-ZÇĞİÖŞÜa-zçğıöşü]+(?: \d{4})?) \d{1,2}:\d{2}',body)
                snip=[l for l in body.split('\n') if len(l)>80]
                c['items'].append(dict(title=title,tags=tag,date=date.group(1) if date else None,snip=snip[0][:400] if snip else ''))
for c in cats.values():
    u={};[u.setdefault(i['title'],i) for i in c['items']]; c['items']=list(u.values())
json.dump({'brands':brands,'cats':cats},open(S+'/sv.json','w'),ensure_ascii=False,indent=1)
for s,b in brands.items():
    c=cats.get(s,{})
    print(f"{s:20} sc={b.get('score')} sat={b.get('satisfaction')} resp={b.get('responseRate')} ans={b.get('answered')} hrs={b.get('respHours')} tot={b.get('complaints')} robot={b.get('robotComplaints')}/{c.get('complaints')} items={len(c.get('items',[]))} ai={'Y' if b.get('aiSummary') else '-'} head={c.get('heading')}")
