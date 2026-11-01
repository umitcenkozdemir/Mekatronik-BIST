# data.json + sv.json -> data2.json (marka satış sonrası verisi, Şikâyetvar konuları, satış sonrası notu)
import json,re,sys,collections
S=sys.argv[1]
D=json.load(open(S+'/data.json')); R=D['items']
SV=json.load(open(S+'/sv.json'))
RSV=json.load(open(S+'/../robot-supurge/sv.json'))['brands']  # marka puanı yedeği (aynı marka sayfası)
SLUG={'Beko':'beko','Arçelik':'arcelik','Bosch':'bosch','Vestel':'vestel','Profilo':'profilo','Altus':'altus','Siemens':'siemens','Samsung':'samsung','Regal':'regal','Uğur':'ugur-sogutma',
 'Grundig':'grundig','LG':'lg','Teka':'teka','Hoover':'hoover','Haier':'haier','Dijitsu':'dijitsu','Electrolux':'electrolux','Tommatech':'tommatech','Toshiba':'toshiba','Franke':'franke',
 'Hafele':'hafele','Kumtel':'kumtel','Windsor':'windsor','Finlux':'finlux','Silverline':'silverline','Şenocak':'senocak','Simfer':'simfer','Küppersbusch':'kuppersbusch','Vestfrost':'vestfrost','Liebherr':'liebherr','Empero':'empero'}
CATSLUG={'Uğur':'ugur'}
# Servis bilgisi: yalnızca doğrulanabilen genel bilgiler (marka siteleri). Bilinmeyenler boş bırakılır.
SVC={
 'Arçelik':dict(dist='Arçelik A.Ş. (yerli üretici)',svc='Arçelik yetkili servis ağı, 444 0 888',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='arcelik.com.tr'),
 'Beko':dict(dist='Arçelik A.Ş. (yerli üretici)',svc='Beko yetkili servis ağı, 444 0 888',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='beko.com.tr'),
 'Altus':dict(dist='Arçelik A.Ş.',svc='Arçelik/Beko yetkili servisleri',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='altus.com.tr'),
 'Grundig':dict(dist='Arçelik A.Ş.',svc='Grundig yetkili servisleri',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='grundig.com.tr'),
 'Bosch':dict(dist='BSH Ev Aletleri (Çerkezköy üretim)',svc='Bosch yetkili servis ağı, 444 6 333',net='Türkiye geneli',parts='Yetkili servis ve online yedek parça',src='bosch-home.com.tr'),
 'Siemens':dict(dist='BSH Ev Aletleri',svc='Siemens yetkili servis ağı',net='Türkiye geneli',parts='Yetkili servis ve online yedek parça',src='siemens-home.bsh-group.com/tr'),
 'Profilo':dict(dist='BSH Ev Aletleri',svc='Profilo yetkili servis ağı',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='profilo.com.tr'),
 'Vestel':dict(dist='Vestel (yerli üretici, Manisa)',svc='Vestel yetkili servis ağı, 444 4 111',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='vestel.com.tr'),
 'Regal':dict(dist='Vestel grubu',svc='Regal/Vestel yetkili servisleri',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='regal-tr.com'),
 'Finlux':dict(dist='Vestel grubu',svc='Vestel yetkili servisleri',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='finlux.com.tr'),
 'Samsung':dict(dist='Samsung Türkiye',svc='Samsung yetkili servis ağı',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='samsung.com/tr/support'),
 'LG':dict(dist='LG Electronics Türkiye',svc='LG yetkili servis ağı',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='lg.com/tr/destek'),
 'Uğur':dict(dist='Uğur Soğutma (yerli üretici)',svc='Uğur yetkili servisleri',net='Türkiye geneli',parts='Yetkili servis üzerinden',src='ugur.com.tr'),
}
ISSUES=[('Servis ve garanti süreci',r'servis|garanti|onar|tamir|ücret talep|kullanıcı hatası|cevapsız|müşteri hizmet|teknisyen'),
 ('Soğutmama / ısı sorunu',r'soğutm|soğutmuyor|ısın|sıcak|dondur(m|u)|buz tut|karlan|buzlan'),
 ('Kompresör, motor, ses',r'kompres|motor|gürültü|\bses\b|uğultu|titre|tıkırt'),
 ('Su akıtma, sızıntı, buzlanma',r'su akıt|sızın|su biri|damla|gider|buzlanma|nem'),
 ('Kapı, conta, raf, kırık',r'kapı|conta|raf|çekmece|kırık|kırıl|çatla|menteşe|kulp'),
 ('Elektronik, ekran, kart',r'kart|ekran|elektronik|panel|sensör|wi-?fi|uygulama|ışık'),
 ('Kargo, teslimat, kurulum',r'TITLE:kargo|teslimat|teslim edil|kurulum|montaj|hasarlı geldi|ezik|çizik'),
 ('Yedek parça',r'yedek|parça'),
 ('İlk kullanımda arıza',r'ilk kullan|kutudan|ilk gün|yeni aldı|sıfır ürün|kısa sürede|ilk ay|yeni alınan')]
def comp(s):
    s=s.lower().replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g').replace('ö','o').replace('ü','u')
    return re.sub(r'[^a-z0-9]','',s)
brands={}; byb=collections.defaultdict(list)
for o in R: byb[o['brand']].append(o); o['svHits']=[]; o['svHitN']=0
for b,items in byb.items():
    slug=SLUG.get(b); sb=dict(SV['brands'].get(slug,{})) if slug else {}
    for k,v in (RSV.get(slug) or {}).items():
        if sb.get(k) is None and k in ('score','ratings','responseRate','pro'): sb[k]=v
    cat=SV['cats'].get(CATSLUG.get(b,slug),{}) if slug else {}
    its=cat.get('items',[])
    iss=collections.Counter()
    for it in its:
        txt=(it['title']+' '+it.get('snip','')).replace('İ','i').replace('I','ı').lower()
        for n,rx in ISSUES:
            if rx.startswith('TITLE:'):
                if re.search(rx[6:],it['title'].replace('İ','i').replace('I','ı').lower()): iss[n]+=1
            elif re.search(rx,txt): iss[n]+=1
    catc=cat.get('complaints') or sb.get('robotComplaints')
    svc=SVC.get(b,{})
    brands[b]=dict(slug=slug,svScore=sb.get('score'),svRatings=sb.get('ratings'),totalComplaints=sb.get('complaints'),catComplaints=catc,
        responseRate=sb.get('responseRate'),satisfaction=sb.get('satisfaction'),respHours=sb.get('respHours'),pro=sb.get('pro'),
        aiSummary=sb.get('aiSummary') if sb.get('aiSummary') and 'buzdolab' in sb['aiSummary'].lower() else None,
        topics=cat.get('topics',[])[:8],sample=len(its),issues=[[n,iss[n]] for n,_ in ISSUES if iss[n]],
        recent=[dict(t=it['title'],d=it.get('date'),m=it['tags'][:2]) for it in its[:6]],models=len(items),
        dist=svc.get('dist'),service=svc.get('svc'),network=svc.get('net'),parts=svc.get('parts'),svcSrc=svc.get('src'))
    for o in items:
        k=comp(re.sub(r'\b(beyaz|siyah|inox|gri|wifi|wi-fi|no frost|nofrost)\b','',o['model'],flags=re.I))
        if len(k)<5: continue
        hits=[it['title'] for it in its if k in comp(it['title']) or any(k==comp(x) for x in it['tags'])]
        o['svHits']=hits[:4]; o['svHitN']=len(hits)
# Satış sonrası notu (0-100): yanıt oranı %35, Şikâyetvar memnuniyet puanı %25, servis ağı %25, şikâyet yoğunluğu %15
mx=max((x['catComplaints'] or 0)/max(x['models'],1) for x in brands.values()) or 1
for b,x in brands.items():
    parts={}
    parts['yanit']=(x['responseRate'] if x['responseRate'] is not None else 40)*0.35
    parts['memnuniyet']=(x['satisfaction'] if x['satisfaction'] is not None else x['svScore'] if x['svScore'] is not None else 30)*0.25
    parts['servis']={'Türkiye geneli':100,'Çok noktalı':75,'Merkezi':55}.get(x['network'],35)*0.25
    # büyük markada mutlak şikâyet sayısı yüksek olur; pazar payı verisi olmadığı için yalnızca 'bilgi var/yok' etkisi küçük tutuldu
    parts['veri']=(100 if x['sample']>=10 else 60 if x['sample'] else 40)*0.15
    has=x['network'] or x['responseRate'] is not None or x['svScore'] is not None
    x['as']=round(sum(parts.values())) if has else None; x['asParts']={k:round(v,1) for k,v in parts.items()} if has else None
for o in R: o['as']=brands[o['brand']]['as']
D['brands']=brands
json.dump(D,open(S+'/data2.json','w'),ensure_ascii=False,separators=(',',':'))
for b,x in sorted(brands.items(),key=lambda kv:-kv[1]['models']):
    print(f"{b:12} m={x['models']:3} as={x['as']} sv={x['svScore']} resp={x['responseRate']} catC={x['catComplaints']} net={x['network']} iss={x['issues'][:3]}")
print('svhits',sum(1 for o in R if o['svHitN']))
