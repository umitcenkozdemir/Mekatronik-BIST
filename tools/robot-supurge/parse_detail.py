import json,re,sys,glob
out={}
def clean(s):
    s=re.sub(r'!\[[^\]]*\]\([^)]*\)','',s)
    return s
for f in glob.glob(sys.argv[1]+'/mcp-Tavily-tavily_extract-*.txt'):
    d=json.load(open(f))
    for r in d.get('results',[]):
        u=r['url']
        if not re.search(r'epey\.com/robot-supurge/[^/]+\.html$',u): continue
        t=r['raw_content']
        specs={}
        ms=[x for x in re.findall(r'\n## [^\n]* Özellikleri\n(.*?)(?=\n## )',t,re.S) if '### ' in x]
        if ms:
            sec=None
            for line in ms[0].split('\n'):
                line=line.strip()
                if line.startswith('### '): sec=line[4:]; continue
                mm=re.match(r'\*\s+\*\*(.+?)\*\*\s*(.*)$',line)
                if not mm: continue
                k,v=mm.groups()
                links=re.findall(r'\[([^\]]+)\]\(https?://[^)]*\)',v)
                if links: vals=[x.strip() for x in links]
                else: vals=[v.strip()]
                specs[k.strip()]=vals
        # sellers
        sellers=[]
        m2=re.search(r'\n## [^\n]* Fiyatları\n(.*?)\n## [^\n]*Fiyat Geçmişi',t,re.S)
        if m2:
            sec=m2.group(1)
            for mm in re.finditer(r'!\[[^\]]*fiyatı\]\(https://resim\.epey\.com/site/([^)]+?)\.(?:png|jpg|svg|webp)\)(.*?)([\d.]+,\d\d) TL',sec,re.S):
                site=mm.group(1).strip(); price=float(mm.group(3).replace('.','').replace(',','.'))
                sp='Sponsorlu' in mm.group(2)
                sellers.append((site,price,sp))
        out[u]=dict(specs=specs,sellers=sellers)
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False)
print(len(out),'detail pages')
from collections import Counter
c=Counter(k for v in out.values() for k in v['specs']); print(c.most_common())
print(Counter(len(v['sellers'])>0 for v in out.values()))
