# list_items.json + details.json -> data.json (özellik puanı, beklenen fiyat, F/P, stok)
import os,json,re,math,collections
S=os.environ.get('BZ_WORK', os.path.dirname(os.path.abspath(__file__)))
CORR=json.load(open(S+'/corrections.json')) if os.path.exists(S+'/corrections.json') else {}
L=json.load(open(S+'/list_items.json')); D=json.load(open(S+'/details.json'))
SITES={'hepsiburada-com':'Hepsiburada','hepsiburada-com_ozel':'Hepsiburada','pttavm-com':'PTT AVM','idefix-com':'Idefix','trendyol-com':'Trendyol','n11-com':'n11','pazarama-com':'Pazarama','amazon-com-tr':'Amazon','beymen-com':'Beymen','mediamarkt-com-tr':'MediaMarkt','ciceksepeti-com':'Çiçeksepeti','teknosa-com':'Teknosa','a101-com-tr':'A101','arcelik-com-tr':'Arçelik','beko-com-tr':'Beko','shop-samsung-com':'Samsung'}
BRANDFIX={'Profılo':'Profilo','Ugur':'Uğur','General':'General Electric','Cool':'Cool Life'}
TYPE={'Üstten Donduruculu':'Üstten donduruculu','Alttan Donduruculu':'Alttan donduruculu','Gardırop Tipi':'Gardırop tipi','Sadece Soğutucu':'Tek kapılı / sadece soğutucu'}
def num(v):
    if not v: return None
    m=re.search(r'(\d+(?:[.,]\d+)?)',v.replace(' ',''))
    return float(m.group(1).replace(',','.')) if m else None
def g(sp,k):
    v=sp.get(k); return ' '.join(v) if v else None
def yes(sp,k): return (sp.get(k) or [''])[0]=='Var'
def yearOf(i):
    if not i: return None
    for t,y in ((640000,2020),(720000,2021),(830000,2022),(895000,2023),(985000,2024),(1050000,2025)):
        if i<t: return y
    return 2026
out=[]
for it in L:
    d=D.get(it['url'])
    if not d: continue
    sp=d['specs']
    if sp.get('Kullanım Tipi')!=['Solo']: continue
    name=re.sub(r'\s+',' ',it['name']).strip()
    b0=name.split()[0]; brand=BRANDFIX.get(b0,b0)
    if brand=='General Electric': model=name.split(' ',2)[-1]
    else: model=name[len(b0):].strip()
    if b0=='Cool': model=name.split(' ',2)[-1]
    ot=set(x.strip() for v in sp.get('Diğer Özellikler',[]) for x in re.split(r'\s{2,}',v) if x.strip())
    nt=set(sp.get('Yeni Nesil Özellikler',[]))
    typ=TYPE.get((sp.get('Buzdolabı Tipi') or ['?'])[0],'Belirtilmemiş')
    coolraw=sp.get('Soğutma Sistemi') or []
    cool='No-Frost' if 'No-Frost' in coolraw else ('Low Frost' if 'Low Frost' in coolraw else ('Statik' if 'Statik' in coolraw else 'Belirtilmemiş'))
    tot=num(g(sp,'Toplam Net Hacim')); coolL=num(g(sp,'Soğutucu Net Hacmi')); frzL=num(g(sp,'Dondurucu Net Hacmi'))
    if not tot and coolL: tot=coolL+(frzL or 0)
    h=num(g(sp,'Yükseklik')); w=num(g(sp,'Genişlik')); dp=num(g(sp,'Derinlik'))
    if h and h<300: h=h*10   # cm -> mm
    if w and w<200: w=w*10
    if dp and dp<200: dp=dp*10
    ecl=(sp.get('Enerji Sınıfı (A-G)') or [None])[0]; kwh=num(g(sp,'Yıllık Enerji Tüketimi')); db=num(g(sp,'Ses Seviyesi'))
    doors=num(g(sp,'Kapı Sayısı'))
    display=yes(sp,'Dijital Ekran'); ice=yes(sp,'Buzmatik'); autoIce='Otomatik Buz Yapıcı' in ot; water=yes(sp,'Su&Buz Pınarı')
    wifi=bool(nt & {'Wi-Fi','Home Connect','Bluetooth','Uzaktan Kontrol'}); ai='Yapay Zeka Desteği' in nt
    zero='0°C Bölmesi' in ot; humid=bool(ot & {'Hassas Nem Kontrolü','Nem Kontrol Düğmesi'})
    multi=bool(nt & {'Çok Yönlü Soğutma','Koku Karıştırmayan Sistem'}) or 'Fanlı Soğutma' in ot
    fresh=sorted(nt & {'Taze Hava Teknolojisi','Gün Işığı Teknolojisi','VitaminZone Teknolojisi','AeroFresh','VitaMod Teknolojisi','Multizone Teknolojisi','VitalCare'}) + sorted(ot & {'Tazelik Filtresi','Koku Giderici','Etilen Filtresi'})
    convert=bool(nt & {'Değiştirilebilir Dondurucu Modu','Kapatılabilir Dondurucu'})
    fastF=yes(sp,'Hızlı Dondurma'); fastC=yes(sp,'Hızlı Soğutma'); holiday='Tatil Modu' in ot; alarm=yes(sp,'Kapı Açık Uyarısı')
    rails=bool(ot & {'Raylı Sebzelik Bölmesi','Asansörlü Kapı Rafı','Yükseklik Ayarlı Soğutma Rafı'})
    rev='Değiştirilebilir Kapı Yönü' in ot; lock=bool(ot & {'Çocuk Kilidi','Ekran Kilidi'})
    comp=20 if '20 Yıl Kompresör Garantili' in ot else (10 if '10 Yıl Kompresör Garantili' in ot else (7 if '7 Yıl Kompresör Garantili' in ot else None))
    keep=num(g(sp,'Elektrik Kesintisinde Saklama Süresi')); fcap=num(g(sp,'Dondurma Kapasitesi'))
    _C=CORR.get(re.sub(r'\.html$','',it['url'].rsplit('/',1)[1]),{})
    cool=_C.get('cool',cool); ecl=_C.get('ecl',ecl); db=_C.get('db',db); typ=_C.get('type',typ)
    sellers={}
    for s,p,_ in d['sellers']:
        n=SITES.get(s,s)
        if n not in sellers or p<sellers[n]: sellers[n]=p
    sl=sorted(sellers.items(),key=lambda x:x[1])
    # ---- özellik puanı (0-100)
    sc={}
    sc['enerji']={'A':25,'B':22,'C':19,'D':15,'E':10,'F':5,'G':2}.get(ecl,6)
    sc['sogutma']={'No-Frost':20,'Low Frost':11,'Statik':5}.get(cool,8)
    sc['ses']=6 if db is None else max(0,min(15,(44-db)/11*15))
    sc['tazelik']=min(15,(5 if zero else 0)+(3 if humid else 0)+(4 if multi else 0)+min(3,1.5*len(fresh)))
    sc['kullanim']=min(12,(2 if display else 0)+(2 if fastF else 0)+(1 if fastC else 0)+(1 if holiday else 0)+(1 if alarm else 0)+(2 if convert else 0)+(1 if rails else 0)+(1 if rev else 0)+(1 if lock else 0))
    sc['akilli']=(4 if wifi else 0)+(2 if ai else 0)
    sc['ekstra']=min(7,(1 if ice else 0)+(2 if autoIce else 0)+(3 if water else 0)+(1 if (comp or 0)>=10 else 0))
    score=round(sum(sc.values()),1)
    img=it.get('img'); yr=yearOf(img)
    out.append(dict(id=re.sub(r'\.html$','',it['url'].rsplit('/',1)[1]),name=name,brand=brand,model=model,type=typ,
        price=round(it['price']),sites=it['sites'],stock=('yok' if (img and img<900000 and it['sites']<=2) else ('var' if it['sites']>=3 else 'sinirli')),
        old=bool(img and img<900000),imgId=img,year=yr,rank=it['rank'],sellers=sl[:8],url=it['url'],
        cool=cool,tot=tot,coolL=coolL,frzL=frzL,h=h,w=w,d=dp,doors=int(doors) if doors else None,ecl=ecl,kwh=kwh,db=db,
        display=display,ice=ice,autoIce=autoIce,water=water,wifi=wifi,ai=ai,zero=zero,humid=humid,multi=multi,fresh=fresh,convert=convert,
        fastF=fastF,fastC=fastC,holiday=holiday,alarm=alarm,rails=rails,rev=rev,lock=lock,comp=comp,keep=keep,fcap=fcap,
        color=g(sp,'Renk'),extras=sorted(ot|nt),score=score,sc={k:round(v,1) for k,v in sc.items()}))
# ---- beklenen fiyat: ln(fiyat) ~ ln(hacim) + tip + özellik puanı  (en küçük kareler)
def feats(o):
    t=o['type']
    return [1.0, math.log(max(o['tot'] or 300,30)), 1.0 if t=='Alttan donduruculu' else 0.0, 1.0 if t=='Gardırop tipi' else 0.0, 1.0 if t.startswith('Tek') else 0.0, o['score']/100]
fit=[o for o in out if o['tot'] and o['stock']!='yok']
X=[feats(o) for o in fit]; Y=[math.log(o['price']) for o in fit]
k=len(X[0]); A=[[sum(X[r][i]*X[r][j] for r in range(len(X))) for j in range(k)] for i in range(k)]; B=[sum(X[r][i]*Y[r] for r in range(len(X))) for i in range(k)]
for i in range(k):  # gauss
    p=max(range(i,k),key=lambda r:abs(A[r][i])); A[i],A[p]=A[p],A[i]; B[i],B[p]=B[p],B[i]
    for r in range(k):
        if r!=i:
            f=A[r][i]/A[i][i]; A[r]=[a-f*c for a,c in zip(A[r],A[i])]; B[r]-=f*B[i]
beta=[B[i]/A[i][i] for i in range(k)]
res=[y-sum(b*x for b,x in zip(beta,xx)) for xx,y in zip(X,Y)]; sd=(sum(r*r for r in res)/len(res))**.5
print('beta',[round(b,3) for b in beta],'sd',round(sd,3),'n',len(fit))
for o in out:
    e=math.exp(sum(b*x for b,x in zip(beta,feats(o))))
    o['expP']=round(e,-2); dev=math.log(o['price']/e)
    o['dev']=round((o['price']/e-1)*100)   # % pahalı(+)/ucuz(-)
    o['fp']=max(0,min(100,round(50-dev/sd*20)))
    o['tlp']=round(o['price']/o['tot']) if o['tot'] else None
# ---- pareto (stokta, aynı tip ve hacim bandında: daha ucuz ve daha yüksek puanlı yok)
def band(o):
    v=o['tot'] or 0
    return 0 if v<300 else 1 if v<450 else 2 if v<550 else 3
for o in out: o['pareto']=False
grp=collections.defaultdict(list)
for o in out:
    if o['stock']!='yok': grp[(o['type'],band(o))].append(o)
for gl in grp.values():
    best=-1
    for o in sorted(gl,key=lambda o:(o['price'],-o['score'])):
        if o['score']>best: o['pareto']=True; best=o['score']
META={'beta':beta,'sd':sd}
json.dump({'meta':META,'items':out},open(S+'/data.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(out),'models',len(set(o['brand'] for o in out)),'brands')
for kk in ['type','cool','ecl','stock']: print(kk,collections.Counter(o[kk] for o in out))
print('pareto',sum(o['pareto'] for o in out))
for o in sorted(out,key=lambda o:-o['fp'])[:12]: print('FP',o['fp'],o['dev'],o['score'],o['price'],o['expP'],o['name'],o['tot'],o['type'])
for o in sorted(out,key=lambda o:-o['score'])[:8]: print('S',o['score'],o['price'],o['name'],o['sc'])
