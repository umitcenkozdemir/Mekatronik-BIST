import json,re,sys,glob
S=sys.argv[1]; D=sys.argv[2]   # D = deep batch dir
Q=json.load(open(f'{D}/queue.json'))
R={o['id']:o for o in json.load(open(S+'/robots2.json'))['items']}
P=json.load(open(S+'/produrls.json'))
exec(open(S+'/sellers.py').read().split('out={}')[0].replace("S=sys.argv[1]","pass"))
def load(n):
    try: return json.load(open(f'{D}/{n}.json')).get('results',[])
    except Exception: return []
def clean(s): return re.sub(r'\s+',' ',re.sub(r'!\[[^\]]*\]\([^)]*\)|\]\([^)]*\)|[\[\]*#]','',s)).strip()
def TLn(s): return float(s.replace('.','').replace(',','.'))
# --- HB product
def hb_product(t,url):
    o={'url':url.split('?')[0]}
    m=re.search(r'\nSatıcı: \[([^\]]+)\]',t); o['seller']=m.group(1) if m else None
    head=t[:t.find('Ürün Bilgileri')] if 'Ürün Bilgileri' in t else t[:20000]
    o['official']='Resmi Satıcı' in head
    m=re.search(r'Takip et[^\n]*\s*\n+(?:\s*Sepete özel fiyat\s*\n+)?\s*([\d.]+,\d\d) TL',head)
    if not m:  # ek garanti / koruma paketi ve "sepete özel" fiyatlarını atla
        m=next((x for x in re.finditer(r'\n([\d.]+,\d\d) TL\s*\n',head) if not re.search(r'Detayları incele|Sepete özel|Ürüne git|Kazancımı gör|kazanç|İndirim',head[max(0,x.start()-60):x.start()])),None)
    o['price']=TLn(m.group(1)) if m else None
    o['buyable']=('Sepete ekle' in head) and not re.search(r'Tükendi|Gelince haber ver|Stokta yok|şu an satışta değil',head,re.I)
    o['tr_warranty']=bool(re.search(r'Türkiye Garantili',t)) ; o['importer']=bool(re.search(r'İthalatçı Garantili',t))
    others=[]
    if 'Diğer satıcılar' in t:
        seg=t[t.find('Diğer satıcılar'):t.find('Ek bilgiler') if 'Ek bilgiler' in t else t.find('Diğer satıcılar')+6000]
        for mm in re.finditer(r'\[([^\]]+)\]\(https://www\.hepsiburada\.com/magaza/[^)]+\)\s*([\d,]+)?(.*?)([\d.]+,\d\d) TL',seg,re.S):
            others.append(dict(seller=mm.group(1),score=mm.group(2),auth=('Yetkili satıcı' in mm.group(3) or 'Resmi' in mm.group(3)),price=TLn(mm.group(4))))
    o['others']=others
    m=re.search(r'\n(\d[,.]\d)\s*\n+\[\*\*(\d[\d.]*)\*\*Değerlendirme',t)
    if m: o['rating']=float(m.group(1).replace(',','.')); o['count']=int(m.group(2).replace('.',''))
    m=re.search(r'Değerlendirme\s*\n+5 (\d+)\s*\n+4 (\d+)\s*\n+3 (\d+)\s*\n+2 (\d+)\s*\n+1 (\d+)',t)
    if m: o['stars']=[int(x) for x in m.groups()]   # 5..1
    o['reviews']=hb_reviews(t)
    return o
def hb_reviews(t):
    out=[]
    for mm in re.finditer(r'\n(\d{1,2} [A-ZÇĞİÖŞÜa-zçğıöşü]+(?: \d{4})?), [A-Za-zçğıöşüÇĞİÖŞÜ]+\|\s*\n+[^\n]*\n+(.+?)\n+(?:Satıcı: ([^\n]+)\n+)?(?:Renk[^\n]*\n+)?Bu değerlendirme faydalı mı\?\s*\n+(\d+)\s*\n+(\d+)',t,re.S):
        txt=clean(mm.group(2))
        if len(txt)<15: continue
        out.append(dict(date=mm.group(1),text=txt[:700],seller=(mm.group(3) or '').strip(),up=int(mm.group(4)),down=int(mm.group(5))))
    return out
# --- HB search fallback: first matching product card
src=open(S+'/parse_rate2.py').read(); exec('import re\n'+src[src.index('ACC='):src.index('WL=')])
def hb_search(t,o):
    k=keyname(o)
    for mm in re.finditer(r'\[!\[Image \d+: ([^\]]+)\]\([^)]*\)\]\((https://www\.hepsiburada\.com/[^ )"]+)',t):
        ct=comp(mm.group(1)); j=ct.find(k)
        if j<0 or ACC.search(mm.group(1)): continue
        if re.match(r'(ultra|pro|plus|max|omni|lite|mini|gen|se|ae|ce|complete|s|e|\d)',ct[j+len(k):]): continue  # başka varyant (ör. D20 -> D20 Ultra)
        if True: return dict(url=mm.group(2),title=mm.group(1),fromSearch=True)
    return None
# --- MediaMarkt search
def mm_search(t,o):
    k=keyname(o); res=[]
    for mm in re.finditer(r'### ([^\n]+)\n(.*?)(?=\n### |\Z)',t,re.S):
        title=mm.group(1).strip(); body=mm.group(2)
        if k not in comp(title) or ACC.search(title): continue
        after=comp(title)[comp(title).find(k)+len(k):]
        if after[:3] in ('plu','pro','max','ult','son','flo') : continue
        pm=re.search(r'₺([\d.]+),–',body)
        mu=re.search(r'\]\((https://www\.mediamarkt\.com\.tr/tr/product/[^)\s"]+)',body)
        avail='Adrese teslimata uygun' in body
        res.append(dict(title=title,url=mu.group(1) if mu else None,price=TLn(pm.group(1)+',00') if pm else None,delivery=avail,store_pickup='Mağazadan teslim al' in body))
    return res[:2]
def variant_ok(k,title):
    ct=comp(title); p=ct.find(k)
    if p<0 or ACC.search(title): return False
    after=ct[p+len(k):]
    return not (after[:3] in ('plu','pro','max','ult','son','flo','omn') or (after[:1].isdigit()) or after[:1] in ('s','c','l','v','x','e') and not after.startswith(('siyah','supurge','sicak','cop','lazer','vacuum','ve')))
def amz_search(t,o):
    k=keyname(o); res=[]
    for mm in re.finditer(r'\n## \[([^\]]+)\]\((https://www\.amazon\.com\.tr/[^)\s]*?/dp/([A-Z0-9]{10}))[^\n]*\n(.*?)(?=\n## |\Z)',t,re.S):
        title,url,asin,body=mm.group(1),mm.group(2),mm.group(3),mm.group(4)[:2500]
        if not variant_ok(k,title): continue
        pm=re.search(r'Fiyat, ürün sayfası\[([\d.]+,\d\d) TL',body)
        rt=re.search(r'([\d,]+)\[_5 yıldız üzerinden.*?\[\((\d[\d.]*)\)\]',body)
        res.append(dict(title=title[:120],url='https://www.amazon.com.tr/dp/'+asin,price=TLn(pm.group(1)) if pm else None,buyable=('Sepete ekle' in body) and bool(pm),
            unavailable=bool(re.search(r'mevcut değil|Stokta yok',body)),lowstock=(re.search(r'Stokta sadece (\d+) adet',body) or [None,None])[1] if re.search(r'Stokta sadece (\d+) adet',body) else None,
            rating=float(rt.group(1).replace(',','.')) if rt else None,count=int(rt.group(2).replace('.','')) if rt else 0,
            delivery=(re.search(r'(ÜCRETSİZ teslimat [^\n]+|teslimat [^\n]+)',body) or [None])[0] if re.search(r'teslimat',body) else None))
    return res[:3]
def tek_search(t,o):
    k=keyname(o); res=[]
    for mm in re.finditer(r'\n### ([^\n]+)\n(.*?)(?=\n### |\Z)',t,re.S):
        title,body=mm.group(1).strip(),mm.group(2)[:1500]
        if not variant_ok(k,title): continue
        prices=re.findall(r'([\d.]+(?:,\d\d)?) TL',body.split('ÜCRETSİZ')[0])
        u=re.search(r'\]\((https://www\.teknosa\.com/[^ )"?]+-p-\d+)',body)
        res.append(dict(title=title[:120],price=TLn(prices[-1] if ',' in prices[-1] else prices[-1]+',00') if prices else None,url=u.group(1) if u else None,
            buyable=bool(prices) and not re.search(r'Tükendi|Stokta yok|Gelince Haber',body,re.I)))
    return res[:2]
def epey_fallback(t,o):
    m=re.search(r'\n## [^\n]* Fiyatları\n(.*?)\n## [^\n]*Fiyat Geçmişi',t,re.S)
    if not m: return []
    offs=[]
    for blk in re.split(r'Siteye Git ❯\*?\*?',m.group(1))[:-1]:
        pm=re.findall(r'([\d.]+,\d\d) TL',blk)
        if not pm: continue
        s=re.search(r'\*\*Satıcı:\*\*\s*([^|*\n]+)',blk)
        seller=s.group(1).strip() if s else None
        cls=classify('',seller,o['brand']) if seller else ('retail','(mağaza)')
        offs.append(dict(store='?',seller=seller or 'Mağaza (doğrudan)',kind=cls[0],price=TLn(pm[-1]),age=None,title=clean(blk)[-120:]))
    return offs
import urllib.parse
out={}
AM={r['url']:r for r in load('amz')}; TK={r['url']:r for r in load('tek')}
E={r['url'].split('?')[0]:r for r in load('epey')}
HB={r['url']:r for r in load('hb')}; HR={r['url']:r for r in load('hbrev')}; MM={r['url']:r for r in load('mm')}
for i in Q:
    o=R[i]; rec={'id':i,'name':o['name']}
    # epey offers fresh
    e=E.get(o['url'])
    offs=[]
    if e:
        m=re.search(r'\n## [^\n]* Fiyatları\n(.*?)\n## [^\n]*Fiyat Geçmişi',e['raw_content'],re.S)
        if m:
            for mm in re.finditer(r'resim\.epey\.com/site/([^)]+?)\.(?:png|jpg|svg|webp)\)(.*?)([\d.]+,\d\d) TL(.{0,200})',m.group(1),re.S):
                site=mm.group(1); seg=mm.group(2)
                s=re.search(r'Satıcı:\*?\*?\s*([^*|\n]+?)\s*(?:\||\*\*|\n|$)',seg)
                seller=s.group(1).strip() if s else None
                age=re.search(r'(\d+ (?:dk|saat|gün) önce)',mm.group(4))
                cls=classify(site,seller,o['brand'])
                offs.append(dict(store=DIRECT.get(site) or MARKET.get(site,site),seller=seller or DIRECT.get(site),kind=cls[0],price=TLn(mm.group(3)),age=age.group(1) if age else None,title=clean(seg)[:120]))
    if not offs and e: offs=epey_fallback(e['raw_content'],o)
    rec['offers']=offs
    nm=urllib.parse.quote_plus(re.sub(r'\(.*?\)','',o['name']).strip())
    a=AM.get('https://www.amazon.com.tr/s?k='+nm)
    if a: rec['amz']=amz_search(a['raw_content'],o)
    tk=TK.get('https://www.teknosa.com/arama/?s='+nm)
    if tk: rec['tek']=tek_search(tk['raw_content'],o)
    hbu=(P.get(i,{}).get('hb') or [None])[0]
    if hbu and hbu in HB:
        rec['hb']=hb_product(HB[hbu]['raw_content'],hbu)
        rv=HR.get(hbu+'-yorumlari')
        if rv:
            more=hb_reviews(rv['raw_content']); seen={x['text'][:60] for x in rec['hb']['reviews']}
            rec['hb']['reviews']+= [x for x in more if x['text'][:60] not in seen]
            if 'stars' not in rec['hb']:
                m=re.search(r'Değerlendirme\s*\n+5 (\d+)\s*\n+4 (\d+)\s*\n+3 (\d+)\s*\n+2 (\d+)\s*\n+1 (\d+)',rv['raw_content'])
                if m: rec['hb']['stars']=[int(x) for x in m.groups()]
    else:
        q='https://www.hepsiburada.com/ara?q='+urllib.parse.quote_plus(re.sub(r'\(.*?\)','',o['name']).strip())
        if q in HB: rec['hbSearch']=hb_search(HB[q]['raw_content'],o)
    mq='https://www.mediamarkt.com.tr/tr/search.html?query='+urllib.parse.quote_plus(re.sub(r'\(.*?\)','',o['name']).strip())
    if mq in MM: rec['mm']=mm_search(MM[mq]['raw_content'],o); rec['mmUrl']=mq
    out[i]=rec
json.dump(out,open(f'{D}/research.json','w'),ensure_ascii=False,indent=1)
for i,r in out.items():
    hb=r.get('hb') or {}
    print(f"{r['name'][:28]:28} offers={len(r['offers'])} kinds={sorted(set(x['kind'] for x in r['offers']))} HB:seller={hb.get('seller')} off={hb.get('official')} buy={hb.get('buyable')} {hb.get('price')} rv={len(hb.get('reviews',[]))} stars={hb.get('stars')} tr={hb.get('tr_warranty')} others={len(hb.get('others',[]))} MM={[ (m['price'],m['delivery'],bool(m.get('url'))) for m in r.get('mm',[])]} AMZ={[(a['price'],a['buyable'],a['count']) for a in r.get('amz',[])]} TEK={[(t['price'],t['buyable']) for t in r.get('tek',[])]}")
