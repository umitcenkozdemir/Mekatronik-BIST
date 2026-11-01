# epey liste sayfaları -> list_items.json   Kullanım: python3 -I parse_list.py <klasör> <çıktı> [kategori=buzdolabi]
import json,re,sys,glob
CAT=sys.argv[3] if len(sys.argv)>3 else 'buzdolabi'
SUF={'buzdolabi':'Buzdolabı'}.get(CAT,'')
items={}
for f in sorted(glob.glob(sys.argv[1]+'/*.json')):
    d=json.load(open(f))
    for r in d['results']:
        if 'epey.com/'+CAT not in r['url']: continue
        pg=re.search(r'/'+CAT+r'/(\d+)/',r['url']); pg=int(pg.group(1)) if pg else 1
        lines=r['raw_content'].split('\n')
        for i,l in enumerate(lines):
            m=re.search(r'\[(?:([\d.]+,\d+) TL ?(\d+) site, (\d+) fiyat|[^\]]*)\]\((https://www\.epey\.com/'+CAT+r'/[^ #]+\.html)#fiyatlar "([^"]+) Fiyatı"\)',l)
            if not m: continue
            price,sites,_,url,full=m.groups()
            name=full[:-len(SUF)].strip() if SUF and full.endswith(SUF) else full
            img=None
            for k in range(i-1,max(0,i-3),-1):
                mi=re.search(r'resim\.epey\.com/(\d+)/',lines[k])
                if mi: img=int(mi.group(1)); break
            vals=[];j=i+1
            while j<len(lines) and len(vals)<3:
                s=lines[j].strip()
                if s.startswith('*'): vals.append(s[1:].strip())
                elif s: break
                j+=1
            if url in items: continue
            items[url]=dict(name=name,url=url,price=float(price.replace('.','').replace(',','.')) if price else None,
               sites=int(sites) if sites else 0,img=img,page=pg,rank=len(items),cool=vals[0] if vals else None,frz=vals[1] if len(vals)>1 else None,tot=vals[2] if len(vals)>2 else None)
json.dump(list(items.values()),open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
pr=[x for x in items.values() if x['price']]
from collections import Counter
print(len(items),'items',len(pr),'priced'); c=Counter(x['page'] for x in pr); print(sorted(c.items()))
