import os
import json,re,math,statistics as st
S=os.environ.get('RS_WORK', os.path.dirname(os.path.abspath(__file__)))
IMG=json.load(open(S+'/imgids.json')) if os.path.exists(S+'/imgids.json') else {}
L=json.load(open(S+'/list_items2.json')); D=json.load(open(S+'/details.json'))
_fresh={x['url'] for x in L}
for x in json.load(open(S+'/list_items.json')):
    if x['url'] not in _fresh and x['type']!='Cam Temizleme Robotu': x['gone']=True; L.append(x)
SITES={'hepsiburada-com':'Hepsiburada','hepsiburada-com_ozel':'Hepsiburada','pttavm-com':'PTT AVM','idefix-com':'Idefix','trendyol-com':'Trendyol','n11-com':'n11','pazarama-com':'Pazarama','amazon-com-tr':'Amazon','beymen-com':'Beymen','mediamarkt-com-tr':'MediaMarkt','ciceksepeti-com':'Çiçeksepeti','teknosa-com':'Teknosa','vatanbilgisayar-com':'Vatan','a101-com-tr':'A101','passo-com-tr':'Passo','inbox-com-tr':'Inbox','arcelik-com-tr':'Arçelik','beko-com-tr':'Beko','turkcell-com-tr':'Turkcell Pasaj'}
BRANDFIX={'Deebot':'Ecovacs','Simart':'Şımart','Şımart':'Şımart'}
def num(v):
    if not v: return None
    m=re.search(r'([\d]+(?:[.,]\d+)?)',v.replace(' ',''))
    return float(m.group(1).replace(',','.')) if m else None
def g(sp,k):
    v=sp.get(k); return ' '.join(v) if v else None
out=[]
for it in L:
    if it['type']=='Cam Temizleme Robotu': continue
    d=D[it['url']]; sp=d['specs']; ot=set(sp.get('Diğer Özellikler',[]))
    name=it['name']
    brand=name.split()[0]; brand=BRANDFIX.get(brand,brand)
    model=name[len(name.split()[0]):].strip()
    if name.startswith('Deebot'): model=name
    typ=(sp.get('Ürün Tipi') or [it['type']])[0]
    pa=num(g(sp,'Emiş Gücü')); mah=num(g(sp,'Pil Kapasitesi')); rt=num(g(sp,'Çalışma Süresi'))
    ch=num(g(sp,'Şarj Süresi')); db=num(g(sp,'Gürültü Seviyesi')); w=num(g(sp,'Güç'))
    dust=num(g(sp,'Toz Haznesi')) or num(g(sp,'Toz + Su Haznesi')); water=num(g(sp,'Su Haznesi'))
    h=num(g(sp,'Yükseklik')); kg=num(g(sp,'Ağırlık')); climb=num(g(sp,'Aşılabilir Yükseklik')); area=num(g(sp,'Temizlenebilir Alan'))
    st_dust=num(g(sp,'İstasyon Toz Kapasitesi')); st_clean=num(g(sp,'İstasyon Temiz Su Kapasitesi')); st_dirty=num(g(sp,'İstasyon Kirli Su Kapasitesi'))
    navraw=(g(sp,'Haritalama Yöntemi') or '')
    nl=navraw.lower()
    has_cam = 'kamera' in nl or 'RGB Kamera' in ot or 'Anlık Görüntü Aktarımı' in ot
    if 'lazer' in nl or 'lidar' in nl or 'lds' in nl or 'PreciSense Lidar' in ot or 'dTof Teknoloji' in ot: nav='LiDAR'
    elif 'vslam' in nl or 'kamera' in nl: nav='Kamera (vSLAM)'
    elif 'tof' in nl: nav='ToF / 3D'
    elif 'jiroskop' in nl or 'Gyro Navigasyon' in ot: nav='Jiroskop'
    elif (sp.get('Haritalama') or [''])[0]=='Var': nav='Diğer'
    else: nav='Rastgele'
    ai = bool(ot & {'Nesne Tanıma','3D Nesne Tanıma','Reactive AI','Reaktif Teknoloji','AI Teknolojisi','Yapay Zeka Teknolojisi','3D Engelden Kaçınma','Otomatik Evcil Hayvan Tanıma'}) or has_cam
    basic_av = bool(ot & {'Engelden Kaçınma','Çarpma Önleme'}) or 'tof' in nl
    obst='Yapay zekâ / kamera' if ai and has_cam else ('3D / yapısal ışık' if ai or ('tof' in nl and nav=='LiDAR') else ('Temel sensör' if basic_av else 'Tampon'))
    wet=(sp.get('Islak Mop') or ['?'])[0]=='Var' or typ=='Robot Mop'
    if not wet: mop='Yok'
    elif 'Rulo Mop' in ot or 'roller' in name.lower(): mop='Rulo mop'
    elif 'Çift Döner Mop' in ot: mop='Çift döner'
    elif ot & {'Titreşimli Mop','Sonik Titreşimli Mop','VibraRise','Ozmo Turbo Mop 2.0'} or 'sonic' in name.lower(): mop='Titreşimli'
    elif 'Basınçlı Mop' in ot: mop='Basınçlı ped'
    else: mop='Sabit ped'
    mop_lift_mm=None
    for o in ot:
        m=re.match(r'([\d.]+) mm Mop Yükseltme',o)
        if m: mop_lift_mm=float(m.group(1))
    mop_lift = mop_lift_mm is not None or bool(ot & {'Mop Alanını Yükseltme','Mop İşlevinde Halıya Çıkmaz','Otomatik Mop Çıkarma','AdaptiLift Şasi'})
    se=(sp.get('Toz Boşaltma İstasyonu') or ['Yok'])[0]; mw=(sp.get('Mop Temizleme İstasyonu') or ['Yok'])[0]
    selfempty = se=='Var'; mopwash = mw=='Var'
    if selfempty and mopwash: station='Tam istasyon'
    elif mopwash: station='Mop yıkama'
    elif selfempty: station='Toz boşaltma'
    else: station='Sadece şarj'
    hotwash='Sıcak Su ile Mop Yıkama' in ot; hotdry='Sıcak Hava ile Mop Kurutma' in ot
    refill='Otomatik Su Haznesi Dolumu' in ot; deterg=bool(ot & {'Otomatik Deterjan Dolumu','DuoSolution Sistemi'})
    mopext='Otomatik Mop Uzatma' in ot; brushext=bool(ot & {'Otomatik Yan Fırça Uzatma','FlexiArm','Kenar Temizliği'}) and 'Otomatik Yan Fırça Uzatma' in ot
    mopdetach='Otomatik Mop Çıkarma' in ot
    carpet='Halı Algılama' in ot or 'Halılara Özelleştirilmiş Modlar' in ot
    pet=bool(ot & {'Hayvan Tüylerinde Etkili','Evcil Hayvan Dostu Mod','Evcil Hayvan Konum Tespiti','Otomatik Evcil Hayvan Tanıma','Evcil Hayvan Fotoğrafı Çekme'})
    tangle=bool([o for o in ot if 'Dolaşma' in o or 'ZeroTangle' in o or 'DuoDivide' in o or 'Kauçuk' in o or 'Tangle' in o])
    hepa=(sp.get('Hepa Filtre') or [''])[0]=='Var'
    wifi=(sp.get('Wi-Fi') or [''])[0]=='Var'
    va=g(sp,'Sesli Asistan') or ''
    voice=[x for x in ['Alexa','Google','Siri'] if x in va]
    matter='Matter Bağlantı Uyumu' in ot
    maps=None
    for o in ot:
        m=re.match(r'(\d+) Ayrı Haritalama',o)
        if m: maps=max(maps or 0,int(m.group(1)))
    multimap = maps is not None or 'Çoklu Harita Desteği' in ot
    map3d='3D Haritalama' in ot
    roomset=bool(ot & {'Oda Bazında Emiş Gücü Ayarı','Oda Bazında Mop Ayarı','Oda Bazında Mod Ayarı'})
    zone=(sp.get('Bölge Bloklama') is not None) or (sp.get('Oda Sınırlandırma') or [''])[0]=='Var'
    sides=num(g(sp,'Yan Fırça Sayısı'))
    uv='UV Sterilizasyon' in ot
    sellers={}
    for s,p,sp_ in d['sellers']:
        n=SITES.get(s,s)
        if n not in sellers or p<sellers[n]: sellers[n]=p
    sl=sorted(sellers.items(),key=lambda x:x[1])
    price=it['price']
    # ---- score (0-100)
    sc={}
    sc['emis']= 0 if not pa else max(0,min(1,math.log(pa/1500)/math.log(30000/1500)))*15
    sc['nav']={'LiDAR':15,'Kamera (vSLAM)':10,'ToF / 3D':9,'Diğer':6,'Jiroskop':4,'Rastgele':0}[nav]
    sc['engel']={'Yapay zekâ / kamera':10,'3D / yapısal ışık':7,'Temel sensör':3,'Tampon':0}[obst]
    sc['mop']={'Yok':0,'Sabit ped':3,'Basınçlı ped':5,'Titreşimli':8,'Çift döner':10,'Rulo mop':11}[mop] + (2 if mop_lift else 0) + (2 if mopext else 0)
    sc['istasyon']=(7 if selfempty else (2 if se=='Opsiyonel' else 0))+(6 if mopwash else 0)+(2 if hotwash else 0)+(2 if hotdry else 0)+(1.5 if refill else 0)+(1.5 if deterg else 0)
    run = rt if rt else (mah/5200*180 if mah else None)
    sc['pil']= 0 if not run else max(0,min(1,(run-60)/(240-60)))*8
    sc['akilli']=(2 if wifi else 0)+(1 if multimap else 0)+(1 if roomset else 0)+(1 if (voice or matter) else 0)+(1 if carpet else 0)+(1 if zone else 0)
    sc['esik']= 0 if not climb else (1 if climb<18 else 2 if climb<22 else 3.5 if climb<40 else 5)
    sc['ekstra']=(2 if brushext else 0)+(1 if tangle else 0)+(1 if hepa else 0)+(1 if pet else 0)
    score=round(sum(sc.values()),1)
    out.append(dict(id=re.sub(r'\.html$','',it['url'].rsplit('/',1)[1]),name=name,brand=brand,model=model,type={'Robot Süpürge+Mop':'Süpürge + Mop','Robot Süpürge':'Sadece süpürge','Robot Mop':'Sadece mop'}.get(typ,typ),
        price=round(price),sites=0 if it.get('gone') else it['sites'],stock='yok' if (it.get('gone') or (IMG.get(it['url'],10**9)<900000 and it['sites']<=2)) else ('var' if it['sites']>=3 else 'sinirli'),old=bool(IMG.get(it['url'],10**9)<900000),gone=bool(it.get('gone')),imgId=IMG.get(it['url']),lastSites=it['sites'],sellers=sl[:8],url=it['url'],
        pa=pa,mah=mah,rt=rt,ch=ch,db=db,w=w,dust=dust,water=water,h=h,kg=kg,climb=climb,area=area,stDust=st_dust,stClean=st_clean,stDirty=st_dirty,
        nav=nav,navRaw=navraw,cam=has_cam,obst=obst,mop=mop,mopLift=mop_lift,mopLiftMm=mop_lift_mm,mopExt=mopext,mopDetach=mopdetach,
        station=station,selfEmpty=selfempty,selfEmptyOpt=se=='Opsiyonel',mopWash=mopwash,hotWash=hotwash,hotDry=hotdry,refill=refill,deterg=deterg,
        brushExt=brushext,carpet=carpet,pet=pet,tangle=tangle,hepa=hepa,wifi=wifi,voice=voice,matter=matter,maps=maps,multimap=multimap,map3d=map3d,roomset=roomset,zone=zone,
        sides=sides,uv=uv,color=g(sp,'Renk Seçenekleri'),extras=sorted(ot),score=score,sc={k:round(v,1) for k,v in sc.items()}))
# value index: score relative to log price, normalized 0-100
import math
xs=[math.log(o['price']) for o in out]; ys=[o['score'] for o in out]
mx=sum(xs)/len(xs); my=sum(ys)/len(ys)
b=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs); a=my-b*mx
print('fit a,b',a,b)
res=[y-(a+b*x) for x,y in zip(xs,ys)]
sd=(sum(r*r for r in res)/len(res))**.5
for o,r in zip(out,res):
    o['exp']=round(a+b*math.log(o['price']),1)
    o['fp']=max(0,min(100,round(50+r/sd*20)))
    o['tlp']=round(o['price']/max(o['score'],1))
META={'a':a,'b':b}
# pareto
for o in out: o['pareto']=False
srt=sorted([o for o in out if o['stock']!='yok'],key=lambda o:(o['price'],-o['score'])); best=-1
for o in srt:
    o['pareto']= o['score']>best
    if o['score']>best: best=o['score']
json.dump({'meta':META,'items':out},open(S+'/robots.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(out),'models',len(set(o['brand'] for o in out)),'brands; size',len(json.dumps(out,ensure_ascii=False,separators=(',',':'))))
from collections import Counter
for k in ['nav','obst','mop','station','type']: print(k,Counter(o[k] for o in out))
print('pareto',[ (o['name'],o['price'],o['score']) for o in srt if o['pareto']])
top=sorted(out,key=lambda o:-o['fp'])[:15]
for o in top: print(o['fp'],o['score'],o['price'],o['name'],o['sites'])
sc=sorted(out,key=lambda o:-o['score'])[:8]
for o in sc: print('S',o['score'],o['price'],o['name'],o['sc'])
