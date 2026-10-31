import json,re,sys,glob
items={}
TYPES=['Robot Süpürge+Mop','Robot Süpürge','Cam Temizleme Robotu']
for f in sorted(glob.glob(sys.argv[1]+'/*.json')):
    d=json.load(open(f))
    for r in d['results']:
        if 'epey.com/robot-supurge' not in r['url']: continue
        r['url']=r['url'].split('?')[0]
        lines=r['raw_content'].split('\n')
        for i,l in enumerate(lines):
            m=re.search(r'\[(?:([\d.]+,\d+) TL ?(\d+) site, (\d+) fiyat|[^\]]*)\]\((https://www\.epey\.com/robot-supurge/[^ #]+\.html)#fiyatlar "([^"]+) Fiyatı"\)',l)
            if not m: continue
            price,sites,_,url,full=m.groups()
            typ=next((t for t in TYPES if full.endswith(t)),'')
            name=full[:-len(typ)].strip() if typ else full
            vals=[];j=i+1
            while j<len(lines) and len(vals)<4:
                s=lines[j].strip()
                if s.startswith('*'): vals.append(s[1:].strip())
                elif s and not s.startswith('*'): break
                j+=1
            items[url]=dict(name=name,url=url,type=typ,
               price=float(price.replace('.','').replace(',','.')) if price else None,
               sites=int(sites) if sites else 0,
               runtime=vals[0] if vals else None, charge=vals[1] if len(vals)>1 else None,
               battery=vals[2] if len(vals)>2 else None, suction=vals[3] if len(vals)>3 else None, src=r['url'])
json.dump(list(items.values()),open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
pr=[x for x in items.values() if x['price']]
from collections import Counter
print(len(items),'items',len(pr),'priced', Counter(x['type'] for x in pr))
c=Counter(x['src'] for x in pr); print(sorted(c.items()))
