# letgo liste sayfalarından ilan (başlık, fiyat, url, konum) çıkarır.
# Kullanım: python3 -I parse_letgo.py <tavily_json>... > ilanlar.json
import json,re,sys
out={}
for f in sys.argv[1:]:
    for r in json.load(open(f)).get('results',[]):
        t=re.sub(r'\n\s*\n+','\n',r.get('raw_content') or '')
        # kart: [başlık](https://www.letgo.com/item/...-iid-N) ... N TL ... başlık \n konum
        for m in re.finditer(r'\n\[([^\]!][^\]]*)\]\((https://www\.letgo\.com/item/[^)]*?-iid-(\d+))\)(.*?)\n([\d.]+) TL\n(.*?)(?=\n\[|\Z)',t,re.S):
            title,url,iid,mid,price,rest=m.groups()
            if len(mid)>600: continue
            loc=re.search(r'\n([A-ZÇĞİÖŞÜ][^\n,]+, [^\n]+)\n',rest+'\n')
            cond=re.search(r'(Yeni Gibi|Yeni|İyi|Makul|Yıpranmış)\b',mid+rest[:200])
            out[iid]=dict(title=title.strip(),price=int(price.replace('.','')),url=url,loc=loc.group(1) if loc else None,src=r['url'])
json.dump(list(out.values()),sys.stdout,ensure_ascii=False,indent=0)
