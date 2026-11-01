# Tavily search (include_raw_content) çıktısından eksik özellik adaylarını çıkarır.
# Kullanım: python3 -I extract.py <id> <tavily_json> [alan ...]  -> JSON: {alan: {"val":..,"n":..,"srcs":[..],"cands":[(val,domain,snippet)]}}
import json,re,sys,collections,urllib.parse
NUM=r'(\d{1,3}(?:[.,]\d{1,2})?)'
P={
 'rt': [(r'(?:run ?time|running time|battery life|working time|operating time|çalışma süresi|kullanım süresi)[^.\n]{0,40}?(?:up to |max\.? |maximum )?(\d{2,3})\s*(?:min|minutes|mins|dk|dakika)',1)],
 'ch': [(r'(?:charging time|charge time|recharge time|şarj süresi|fast charging)[^.\n]{0,30}?'+NUM+r'\s*(?:h\b|hrs?|hours?|saat)',1),
        (r'(?:charging time|charge time|şarj süresi)[^.\n]{0,30}?(\d{2,3})\s*(?:min|minutes|dk|dakika)',1/60)],
 'db': [(r'(?:noise|sound|gürültü|ses seviyesi)[^.\n]{0,40}?(\d{2})(?:\s*[-–]\s*\d{2})?\s*d[bB]',1),(r'(\d{2})\s*d[bB](?:A)?\b[^.\n]{0,20}(?:noise|quiet)',1)],
 'kg': [(r'(?:robot weight|net weight|weight of the robot|robot:?\s*weight|ağırlık|weight)[^.\n]{0,25}?'+NUM+r'\s*kg',1),
        (r'(?:robot weight|net weight|weight)[^.\n]{0,25}?'+NUM+r'\s*(?:lbs?|pounds)',0.4536)],
 'water': [(r'(?:water tank|su haznesi|su tankı|onboard water)[^.\n]{0,30}?(\d{2,3})\s*(?:ml|mL)',1)],
 'dust': [(r'(?:dust ?bin|dust box|dust container|toz haznesi|dustbin capacity)[^.\n]{0,30}?(\d{3})\s*(?:ml|mL)',1)],
 'stDust': [(r'(?:dust bag|toz torbası|bag capacity|disposable bag)[^.\n]{0,30}?'+NUM+r'\s*(?:l\b|L\b|liters?|litre|lt)',1)],
 'stClean': [(r'(?:clean water tank|fresh water tank|clean water|temiz su)[^.\n]{0,30}?'+NUM+r'\s*(?:l\b|L\b|liters?|litre|lt)',1)],
 'stDirty': [(r'(?:dirty water tank|waste water tank|dirty water|kirli su)[^.\n]{0,30}?'+NUM+r'\s*(?:l\b|L\b|liters?|litre|lt)',1)],
 'climb': [(r'(?:threshold|obstacle cross|climb|climbing|step|eşik|engel aşma|aşılabilir)[^.\n]{0,40}?'+NUM+r'\s*mm',1),
           (r'(?:threshold|obstacle cross|climb|climbing|eşik|engel aşma)[^.\n]{0,40}?'+NUM+r'\s*cm',10)],
 'mah': [(r'(\d{4})\s*mAh',1)],
 'h': [(r'(?:robot height|height|yükseklik)[^.\n]{0,25}?(\d{2,3}(?:[.,]\d)?)\s*mm',1),(r'(?:robot height|height|yükseklik)[^.\n]{0,25}?(\d{1,2}(?:[.,]\d{1,2})?)\s*cm',10)],
 'pa': [(r'(\d{1,2}[.,]?\d{3})\s*Pa\b',1)],
 'sides': [(r'\b(dual|two|2|single|one|1)\s*(?:rotating\s*)?side brush',1)],
}
RANGE={'rt':(60,400),'ch':(1,10),'db':(40,80),'kg':(2,12),'water':(50,600),'dust':(150,800),'stDust':(1,6),'stClean':(2,6),'stDirty':(2,6),'climb':(10,100),'mah':(2000,8000),'h':(60,130),'pa':(1000,50000),'sides':(1,2)}
def num(s,mul):
    if s.lower() in ('dual','two','2'): return 2
    if s.lower() in ('single','one','1') and mul==1 and not s[0].isdigit() or s=='1': pass
    if s.lower() in ('single','one'): return 1
    v=float(s.replace('.','').replace(',','.')) if re.match(r'^\d{1,2}[.,]\d{3}$',s) else float(s.replace(',','.'))
    return round(v*mul,2)
def main():
    mid=sys.argv[1]; f=sys.argv[2]; fields=sys.argv[3:]
    R=json.load(open(f)).get('results',[])
    out={}
    for fld in fields:
        cands=[]
        for r in R:
            t=(r.get('raw_content') or r.get('content') or '')
            dom=urllib.parse.urlparse(r['url']).netloc.replace('www.','')
            for pat,mul in P.get(fld,[]):
                for m in re.finditer(pat,t,re.I):
                    try: v=num(m.group(1),mul)
                    except Exception: continue
                    lo,hi=RANGE[fld]
                    if not(lo<=v<=hi): continue
                    snip=re.sub(r'\s+',' ',t[max(0,m.start()-50):m.end()+20])
                    cands.append((v,dom,snip))
        c=collections.Counter(v for v,_,_ in cands)
        doms=collections.defaultdict(set)
        for v,d,_ in cands: doms[v].add(d)
        best=max(c,key=lambda v:(len(doms[v]),c[v])) if c else None
        out[fld]=dict(val=best,n=len(doms[best]) if best is not None else 0,srcs=sorted(doms[best]) if best is not None else [],alts={str(k):len(doms[k]) for k in c if k!=best},cands=cands[:6])
    print(json.dumps(out,ensure_ascii=False))
main()
