# Buzdolabı satıcı sınıflama + offers.json üretimi (epey detay sayfalarından)
import json,glob,re,sys,collections
S=sys.argv[1]
def norm(s): return re.sub(r'[^a-z0-9]','',s.lower().replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g').replace('ö','o').replace('ü','u').replace('İ','i'))
DIRECT={'mediamarkt-com-tr':'MediaMarkt','teknosa-com':'Teknosa','vatanbilgisayar-com':'Vatan','beymen-com':'Beymen','a101-com-tr':'A101','beko-com-tr':'Beko','arcelik-com-tr':'Arçelik','shop-samsung-com':'Samsung','koctas-com-tr':'Koçtaş','turkcell-com-tr':'Turkcell Pasaj'}
MARKET={'hepsiburada-com':'Hepsiburada','hepsiburada-com_ozel':'Hepsiburada','amazon-com-tr':'Amazon','trendyol-com':'Trendyol','n11-com':'n11','pttavm-com':'PTT AVM','pazarama-com':'Pazarama','idefix-com':'Idefix','ciceksepeti-com':'Çiçeksepeti'}
BIG=['hepsiburada','amazoncomtr','amazon','trendyol','n11','mediamarkt','teknosa','vatanbilgisayar','saturn','a101','turkcell','koctas','evkur','migros','carrefoursa','bimcell']
# üretici grupları: grup markalarından birinin adını taşıyan mağaza = resmi/yetkili
GROUP={'arcelik':['arcelik','beko','altus','grundig'],'beko':['arcelik','beko','altus','grundig'],'altus':['arcelik','beko','altus','grundig'],'grundig':['arcelik','beko','altus','grundig'],
 'bosch':['bosch','siemens','profilo','bsh'],'siemens':['siemens','bosch','profilo','bsh'],'profilo':['profilo','bosch','siemens','bsh'],
 'vestel':['vestel','regal','finlux'],'regal':['regal','vestel'],'finlux':['finlux','vestel'],'samsung':['samsung'],'lg':['lgelectronics','lgturkiye','lgresmi'],
 'ugur':['ugur'],'hoover':['hoover','candy'],'haier':['haier'],'teka':['teka'],'electrolux':['electrolux'],'dijitsu':['dijitsu'],'franke':['franke'],'toshiba':['toshiba'],'tommatech':['tommatech']}
def classify(site,seller,brand):
    if site in DIRECT: return 'retail',DIRECT[site]
    n=norm(seller or ''); b=norm(brand)
    if any(x==n or n.startswith(x) for x in BIG): return 'retail',seller
    keys=GROUP.get(b,[b] if b else [])
    if any(k and k in n for k in keys): return 'brand',seller
    if 'yetkili' in n or 'bayi' in n: return 'brand',seller
    return 'market',seller
if __name__=='__main__':
    out={}
    for f in glob.glob(S+'/raw_detail/*.txt'):
        for r in json.load(open(f)).get('results',[]):
            u=r['url'].split('?')[0]
            if not re.search(r'buzdolabi/[^/]+\.html$',u): continue
            t=r['raw_content']
            m=re.search(r'\n## [^\n]* Fiyatları\n(.*?)\n## [^\n]*Fiyat Geçmişi',t,re.S)
            offers=[]
            if m:
                for mm in re.finditer(r'resim\.epey\.com/site/([^)]+?)\.(?:png|jpg|svg|webp)\)(.*?)([\d.]+,\d\d) TL(.{0,200})',m.group(1),re.S):
                    site=mm.group(1); seg=mm.group(2)
                    s=re.search(r'Satıcı:\*?\*?\s*([^*|\n]+?)\s*(?:\||\*\*|\n|$)',seg)
                    age=re.search(r'(\d+ (?:dk|saat|gün) önce)',mm.group(4))
                    offers.append(dict(site=site,store=DIRECT.get(site) or MARKET.get(site,site),seller=s.group(1).strip() if s else None,price=float(mm.group(3).replace('.','').replace(',','.')),age=age.group(1) if age else None))
            if m and not offers:  # mağaza logosu olmayan sayfa düzeni: sadece satıcı adı ve fiyat
                for blk in re.split(r'Siteye Git ❯\*?\*?',m.group(1))[:-1]:
                    pm=re.findall(r'([\d.]+,\d\d) TL',blk)
                    if not pm: continue
                    sm=re.search(r'\*\*Satıcı:\*\*\s*([^|*\n]+)',blk)
                    offers.append(dict(site='',store='?',seller=sm.group(1).strip() if sm else None,price=float(pm[-1].replace('.','').replace(',','.')),age=None))
            out[u]=offers
    json.dump(out,open(S+'/offers.json','w'),ensure_ascii=False)
    print(len(out),'pages', sum(1 for v in out.values() if v),'with offers')
    print(collections.Counter(o['seller'] for v in out.values() for o in v).most_common(40))
