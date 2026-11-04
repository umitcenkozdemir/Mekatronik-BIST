import json,glob,re,sys,collections
S=sys.argv[1]
def norm(s): return re.sub(r'[^a-z0-9]','',s.lower().replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g').replace('ö','o').replace('ü','u').replace('İ','i'))
DIRECT={'mediamarkt-com-tr':'MediaMarkt','teknosa-com':'Teknosa','vatanbilgisayar-com':'Vatan','beymen-com':'Beymen','a101-com-tr':'A101','beko-com-tr':'Beko','arcelik-com-tr':'Arçelik','inbox-com-tr':'Inbox','turkcell-com-tr':'Turkcell Pasaj','passo-com-tr':'Passo'}
MARKET={'hepsiburada-com':'Hepsiburada','hepsiburada-com_ozel':'Hepsiburada','amazon-com-tr':'Amazon','trendyol-com':'Trendyol','n11-com':'n11','pttavm-com':'PTT AVM','pazarama-com':'Pazarama','idefix-com':'Idefix','ciceksepeti-com':'Çiçeksepeti'}
BIG=['hepsiburada','amazoncomtr','amazon','trendyol','n11','mediamarkt','teknosa','vatanbilgisayar','saturn','a101','turkcell','koctas','evkur','migros','carrefoursa','arcelik','beko']
DIST=['santis','recci','globalsmart','karaca','kea','certus','htsteknik','xiaomiturkiye','mistore','resmi','official','turkiye','turkey']
def classify(site,seller,brand):
    if site in DIRECT: return 'retail',DIRECT[site]
    n=norm(seller or '')
    b=norm(brand)
    if any(x==n or n.startswith(x) for x in BIG): return 'retail',seller
    if b and b in n: return 'brand',seller
    if any(x in n for x in ['santis','recci','globalsmart','homend','simartpazarlama','fakirhausgerate','purees']): return 'brand',seller
    return 'market',seller
import os,time
# Birleştirerek güncelle: yeni çekilen sayfalar eskilerin yerine geçer, diğerleri korunur. offers_meta.json her sayfanın çekilme tarihini tutar.
out=json.load(open(S+'/offers.json')) if os.path.exists(S+'/offers.json') else {}
META=json.load(open(S+'/offers_meta.json')) if os.path.exists(S+'/offers_meta.json') else {}
for f in sorted(glob.glob(S+'/raw_detail/*.txt'),key=os.path.getmtime):
    for r in json.load(open(f)).get('results',[]):
        u=r['url'].split('?')[0]
        if not re.search(r'robot-supurge/[^/]+\.html$',u): continue
        t=r['raw_content']
        m=re.search(r'\n## [^\n]* Fiyatları\n(.*?)\n## [^\n]*Fiyat Geçmişi',t,re.S)
        offers=[]
        if m:
            for mm in re.finditer(r'resim\.epey\.com/site/([^)]+?)\.(?:png|jpg|svg|webp)\)(.*?)([\d.]+,\d\d) TL(.{0,200})',m.group(1),re.S):
                site=mm.group(1); seg=mm.group(2)
                s=re.search(r'Satıcı:\*?\*?\s*([^*|\n]+?)\s*(?:\||\*\*|\n|$)',seg)
                title=re.sub(r'\*\*Satıcı.*','',re.sub(r'!\[[^\]]*\]\([^)]*\)','',seg)).strip()[:160]
                age=re.search(r'(\d+ (?:dk|saat|gün) önce)',mm.group(4))
                offers.append(dict(site=site,store=DIRECT.get(site) or MARKET.get(site,site),seller=s.group(1).strip() if s else None,price=float(mm.group(3).replace('.','').replace(',','.')),title=title,age=age.group(1) if age else None))
        if m and not offers:
            # bazı çekimlerde mağaza logoları gelmiyor: satıcı adlarından ayrıştır (mağaza bilinmiyorsa '?')
            for mm in re.finditer(r'\*\*Satıcı:\*\*\s*([^*|\n]+?)\s*(?:\||\n).*?([\d.]+,\d\d) TL(.{0,120})',m.group(1),re.S):
                sel=mm.group(1).strip(); age=re.search(r'(\d+ (?:dk|saat|gün) önce)',mm.group(3))
                st='Hepsiburada' if norm(sel)=='hepsiburada' else '?'
                offers.append(dict(site='',store=st,seller=sel,price=float(mm.group(2).replace('.','').replace(',','.')),title='',age=age.group(1) if age else None))
        if offers or u not in out:
            out[u]=offers; META[u]=time.strftime('%Y-%m-%d',time.localtime(os.path.getmtime(f)))
json.dump(out,open(S+'/offers.json','w'),ensure_ascii=False)
json.dump(META,open(S+'/offers_meta.json','w'),ensure_ascii=False)
print(len(out))
