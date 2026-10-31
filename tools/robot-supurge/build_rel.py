import json,re,sys,collections,math
S=sys.argv[1]
D=json.load(open(S+'/robots.json')); R=D['items']
SV=json.load(open(S+'/sv.json')); RT=json.load(open(S+'/ratings.json'))
for o in R:
    if o['brand']=='Grundıg': o['brand']='Grundig'
SLUG={'Roborock':'roborock','Dreame':'dreame','Xiaomi':'xiaomi','Ecovacs':'ecovacs','iRobot':'irobot','Philips':'philips','Fakir':'fakir','Mova':'mova','Homend':'homend','Lydsto':'lydsto','Cecotec':'cecotec','Beko':'beko','Arçelik':'arcelik','Tefal':'tefal','Anker':'anker','Narwal':'narwal','Karcher':'karcher','Viomi':'viomi','TP-Link':'tp-link','Dyson':'dyson','Mamibot':'mamibot','Yui':'yui','Ezviz':'ezviz','Electrolux':'electrolux','Samsung':'samsung','Bosch':'bosch','Hoover':'hoover','Miele':'miele','DJI':'dji','Grundig':'grundig','TCL':'tcl','Blaupunkt':'blaupunkt','Midea':'midea','Yeedi':'yeedi'}
# manual overrides from inline fetches (query-mode results)
OV={'roborock':{'score':17,'ratings':1658},'fakir':{'responseRate':100,'pro':'10+ yıldır'},'dyson':{'warrantyFaq':2},'anker':{'score':8,'ratings':132},'ezviz':{'score':0,'ratings':6}}
# service info (sources: brand sites & searches, 31 Ekim 2026)
SVC={
 'Roborock':dict(w=2,dist='Roborock Türkiye',svc='Recci Teknoloji (tek resmi yetkili servis, kargo ile)',net='Merkezi',parts='Orijinal sarf bazen stokta yok; uyumlu yedek parça bol',src='tr.roborock.com/pages/service-warranty'),
 'Dreame':dict(w=2,dist='Dreame Türkiye',svc='Teknoser yetkili servis; çağrı merkezi 0850 762 0100',net='Merkezi',parts='Resmi sitede aksesuar satışı var',src='dreametech.com.tr/pages/aftersales-policy'),
 'Xiaomi':dict(w=2,dist='Xiaomi Türkiye (resmi) ve ithalatçılar',svc='mi.com/tr yetkili servis listesi; "Xiaomi Türkiye Garantili" ürünlerde',net='Çok noktalı',parts='Uyumlu sarf çok yaygın',src='mi.com/tr/support/service-centre',note='İthalatçı garantili ürünlerde servis süreci farklı; faturada "Türkiye garantili" ibaresine bakın'),
 'Ecovacs':dict(w=2,dist='Santis (Türkiye distribütörü)',svc='Santis teknik servis, 0850 480 23 13',net='Merkezi',parts='Resmi mağazada sarf var',src='help.ecovacs.com/tr/support/service-centers'),
 'iRobot':dict(w=2,dist='Certus Mercatus',svc='HTS Teknik Hizmetler (İstanbul; il dışından ücretsiz kargo)',net='Merkezi',parts='Uyumlu sarf yaygın',src='irobot.com.tr/servis'),
 'Mova':dict(w=3,dist='MOVA Türkiye',svc='Merkezi servis, 0850 251 01 00',net='Merkezi',parts='Resmi sitede aksesuar satışı var',src='tr.mova.tech'),
 'Narwal':dict(w=2,dist='Narwal Türkiye distribütörü',svc='WhatsApp destek; servis KVK üzerinden (kullanıcı bildirimi)',net='Çok noktalı',parts='Aksesuarlar yurt içinde sınırlı, servisten temin',src='forum.donanimhaber.com (Narwal kulübü)'),
 'Lydsto':dict(w=2,dist='Global Smart Elektronik',svc='Bağcılar/İstanbul merkezi teknik servis',net='Merkezi',parts='Resmi sitede sarf kategorisi var',src='lydsto.com.tr/garanti-ve-teknik-servis'),
 'Şımart':dict(w=2,dist='Şımart Teknoloji (yerli)',svc='"48 saatte çözüm" taahhütlü teknik servis',net='Merkezi',parts='Yedek parça doğrudan firmadan',src='simart.me'),
 'Homend':dict(w=2,dist='Karaca Grubu',svc='KEA yetkili servis noktaları (Türkiye geneli)',net='Türkiye geneli',parts='Karaca mağazaları ve sitede yedek parça',src='homend.com.tr/bilgilendirme/kea-yetkili-servisleri'),
 'Karaca':dict(w=2,dist='Karaca',svc='KEA yetkili servis noktaları',net='Türkiye geneli',parts='Karaca yedek parça sayfası',src='karaca.com/bilgilendirme/kea-yetkili-servisleri'),
 'Viomi':dict(w=2,dist='Viomi Türkiye distribütörü',svc='0850 886 80 80 satış sonrası hattı',net='Merkezi',parts='Yedek parça distribütörden',src='viomihome.com/servis-garanti'),
 'Anker':dict(w=2,dist='Anker/eufy Türkiye',svc='KVK Teknik Servis',net='Çok noktalı',parts='Uyumlu sarf yaygın',src='kvkteknikservis.com/servis/eufy'),
 'Cecotec':dict(w=2,dist='cecotectr.com (resmi distribütör)',svc='Yetkili servis + WhatsApp destek',net='Merkezi',parts='Bazı modellerde toz torbası temini sorunu bildirilmiş',src='cecotectr.com/cecotec-nedir'),
 'Yui':dict(w=2,dist='Yui Türkiye',svc='Teknik servis 0850 532 80 08',net='Merkezi',parts='Firmadan',src='yui.com.tr/iletisim'),
 'TP-Link':dict(w=2,dist='TP-Link Türkiye',svc='Çağrı merkezi 444 0 375',net='Merkezi',parts='Resmi aksesuar satışı',src='tp-link.com/tr/support/replacement-warranty'),
 'Fakir':dict(w=2,dist='Fakir (yerli)',svc='Türkiye geneli yetkili servis ağı; online yedek parça',net='Türkiye geneli',parts='Resmi yedek parça portalı',src='destek.fakir.com.tr',note='Kampanyalarda 2+1 ek garanti'),
 'Philips':dict(w=2,dist='Philips Türkiye',svc='Philips yetkili servisleri',net='Türkiye geneli',parts='Resmi yedek parça/aksesuar',src='philips.com.tr/c-s/support/repair-and-exchange'),
 'Arçelik':dict(w=2,dist='Arçelik (yerli)',svc='Arçelik yetkili servis ağı',net='Türkiye geneli',parts='Servis üzerinden',src='arcelik.com.tr'),
 'Beko':dict(w=2,dist='Beko (Arçelik)',svc='Beko yetkili servis ağı',net='Türkiye geneli',parts='Servis üzerinden',src='beko.com.tr'),
 'Tefal':dict(w=2,dist='Groupe SEB Türkiye',svc='Groupe SEB yetkili servisleri',net='Türkiye geneli',parts='Servis üzerinden',src='tefal.com.tr'),
 'Rowenta':dict(w=2,dist='Groupe SEB Türkiye',svc='Groupe SEB yetkili servisleri',net='Türkiye geneli',parts='Servis üzerinden',src='rowenta.com.tr'),
 'Samsung':dict(w=2,dist='Samsung Türkiye',svc='Samsung yetkili servis ağı',net='Türkiye geneli',parts='Servis üzerinden',src='samsung.com/tr'),
 'Bosch':dict(w=2,dist='BSH Türkiye',svc='Bosch yetkili servis ağı',net='Türkiye geneli',parts='Servis üzerinden',src='bosch-home.com.tr'),
 'Dyson':dict(w=2,dist='Dyson Türkiye',svc='Dyson servis (kargo ile)',net='Merkezi',parts='Resmi sitede parça',src='sikayetvar.com/dyson (SSS)'),
 'Miele':dict(w=2,dist='Miele Türkiye',svc='Miele servis ağı',net='Türkiye geneli',parts='Resmi',src='miele.com.tr'),
 'Karcher':dict(w=2,dist='Kärcher Türkiye',svc='Kärcher yetkili servisleri',net='Türkiye geneli',parts='Resmi',src='kaercher.com/tr'),
 'Electrolux':dict(w=2,dist='Electrolux Türkiye',svc='Electrolux yetkili servisleri',net='Türkiye geneli',parts='Servis üzerinden',src='electrolux.com.tr'),
 'Grundig':dict(w=2,dist='Arçelik',svc='Grundig yetkili servisleri',net='Türkiye geneli',parts='Servis üzerinden',src='grundig.com.tr'),
 'Hoover':dict(w=2,dist='Candy Hoover Türkiye',svc='Hoover yetkili servisleri',net='Türkiye geneli',parts='Servis üzerinden',src='hoover.com.tr'),
}
ISSUES=[('Servis ve garanti süreci',r'servis|garanti|onar|tamir|ücret talep|kullanıcı hatası|cevapsız|müşteri hizmet'),
 ('Yedek parça ve sarf',r'yedek|parça|filtre|torba|stok|sarf'),
 ('Şarj ve batarya',r'şarj|batarya|\bpil|istasyon(a|una) (dön|otur|gir)|yuva'),
 ('Harita, sensör, navigasyon',r'harita|lidar|lazer|sensör|navigasyon|çarp|kayb|rota|konum|dönüyor|takıl'),
 ('Mop, su ve istasyon',r'mop|paspas|\bsu\b|su (hazne|tank|akıt|sız)|yıkama|kurutma|damla|tank|deterjan|akıtma'),
 ('Fırça, tekerlek, motor',r'fırça|tekerlek|motor|kapa[ğk]ı|kırıl|gürültü|\bses\b|vakum'),
 ('Uygulama ve bağlantı',r'uygulama|wi-?fi|bağlan|kurulum|güncelleme|yazılım|internet'),
 ('Kargo, teslimat, satıcı',r'TITLE:kargo|teslimat|teslim edil|satıcı|sipariş|fatura'),
 ('İlk kullanımda arıza',r'ilk kullan|kutudan|ilk gün|yeni aldı|sıfır ürün|kısa sürede|ilk ay')]
def comp(s):
    s=s.lower().replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g').replace('ö','o').replace('ü','u').replace('+',' plus ')
    s=re.sub(r'\bq\s*revo','qrevo',s); return re.sub(r'[^a-z0-9]','',s)
brands={}
byb=collections.defaultdict(list)
for o in R: byb[o['brand']].append(o)
for o in R: o['svHits']=[]; o['svHitN']=0
for b,items in byb.items():
    slug=SLUG.get(b); sb=dict(SV['brands'].get(slug,{})) if slug else {}
    sb.update(OV.get(slug,{}))
    cat=SV['cats'].get(slug,{}) if slug else {}
    if cat.get('heading') and ',' in cat['heading']: cat={}
    its=cat.get('items',[])
    iss=collections.Counter()
    for it in its:
        txt=(it['title']+' '+it.get('snip','')).replace('İ','i').replace('I','ı').lower()
        for n,rx in ISSUES:
            if rx.startswith('TITLE:'):
                if re.search(rx[6:],it['title'].replace('İ','i').replace('I','ı').lower()): iss[n]+=1
            elif re.search(rx,txt): iss[n]+=1
    # user ratings aggregate
    rc=0;rw=0
    for o in items:
        r=RT.get(o['id']) or {}
        for s in ('hb','am'):
            x=r.get(s) or {}
            if x.get('count') and x.get('rating'): rc+=x['count']; rw+=x['count']*x['rating']
    robotc=cat.get('complaints') or sb.get('robotComplaints')
    svc=SVC.get(b,{})
    brands[b]=dict(slug=slug,svScore=sb.get('score'),svRatings=sb.get('ratings'),totalComplaints=sb.get('complaints'),robotComplaints=robotc,
        responseRate=sb.get('responseRate'),answered=sb.get('answered'),respHours=sb.get('respHours'),satisfaction=sb.get('satisfaction'),solved=sb.get('solved'),
        pro=sb.get('pro'),aiSummary=sb.get('aiSummary') if sb.get('aiSummary') and ('robot' in sb['aiSummary'].lower() or 'süpürge' in sb['aiSummary'].lower() or b in ('Mova','Lydsto','Viomi','Narwal','Yeedi','Ezviz')) else None,
        topics=[t for t in cat.get('topics',[])][:8],sample=len(its),issues=[[n,iss[n]] for n,_ in ISSUES if iss[n]],
        recent=[dict(t=it['title'],d=it.get('date'),m=it['tags'][:2]) for it in its[:6]],
        userRating=round(rw/rc,2) if rc else None,userCount=rc,models=len(items),
        density=round(robotc/rc*1000) if robotc and rc>=300 else None,
        warranty=svc.get('w',2) if svc else None,dist=svc.get('dist'),service=svc.get('svc'),network=svc.get('net'),parts=svc.get('parts'),svcNote=svc.get('note'),svcSrc=svc.get('src'))
    # model mentions in sample
    for o in items:
        k=re.sub(r'robot|vacuum|cleaner','',comp(re.sub(r'\(.*?\)','',o['model'] or o['name'])))
        if len(k)<4 or k in ('robert','robot','combo'): continue
        hits=[]
        for it in its:
            tags=[re.sub(r'robot|vacuum','',comp(x)) for x in it['tags']]
            t=re.sub(r'robot|vacuum|supurge','',comp(it['title']))
            ok=k in tags
            p=t.find(k)
            if not ok and p>=0:
                after=t[p+len(k):]
                ok=not after[:1].isalnum() or after.startswith(('servis','sarj','surekli','ve','ile','ilk','icin','arıza','ariza','hata','modeli','model','de','da','te','ta','in','un','nin','nun','yi','yu','i','u','e','a'))
                if after.startswith(('pro','plus','max','ultra','omni','sonic','flow','complete','s','e','c','l','v','x')) and not after.startswith(('servis','sarj','surekli','ve','e ','a ')): ok=False
            if ok: hits.append(it['title'])
        o['svHits']=hits[:4]; o['svHitN']=len(hits)
# brand "after-sales" score 0-100 (transparent)
for b,x in brands.items():
    parts={}
    parts['yanit']=(x['responseRate'] if x['responseRate'] is not None else 40)*0.25
    parts['memnuniyet']=((x['satisfaction'] if x['satisfaction'] is not None else x['svScore'] if x['svScore'] is not None else 30))*0.15
    ur=x['userRating']; parts['kullanici']=(max(0,min(1,(ur-3.3)/1.4))*100 if ur else 50)*0.25
    net={'Türkiye geneli':100,'Çok noktalı':75,'Merkezi':55}.get(x['network'],30); parts['servis']=net*0.2
    parts['garanti']=(100 if (x['warranty'] or 0)>=3 else 60 if x['warranty'] else 30)*0.15
    has=x['network'] or x['responseRate'] is not None or x['svScore'] is not None or (x['userCount'] or 0)>=20
    x['as']=round(sum(parts.values())) if has else None; x['asParts']={k:round(v,1) for k,v in parts.items()} if has else None
    x['hasData']=bool(has or x['robotComplaints'] or x['sample'])
for o in R:
    r=RT.get(o['id']) or {}
    hb=r.get('hb') or {}; am=r.get('am') or {}
    o['hb']=[hb.get('rating'),hb.get('count',0)] if hb.get('count') else None
    o['am']=[am.get('rating'),am.get('count',0)] if am.get('count') else None
    c=(hb.get('count') or 0)+(am.get('count') or 0)
    o['ur']=round(((hb.get('rating') or 0)*(hb.get('count') or 0)+(am.get('rating') or 0)*(am.get('count') or 0))/c,2) if c else None
    o['urc']=c
    o['acc']=(hb.get('acc') or 0)+(am.get('acc') or 0)
    o['as']=brands[o['brand']]['as']
D['brands']=brands
json.dump(D,open(S+'/robots2.json','w'),ensure_ascii=False,separators=(',',':'))
print('size',len(json.dumps(D,ensure_ascii=False,separators=(',',':'))))
for b,x in sorted(brands.items(),key=lambda kv:-kv[1]['models'])[:34]:
    print(f"{b:11} m={x['models']:2} as={x['as']} sv={x['svScore']} resp={x['responseRate']} robotC={x['robotComplaints']} ur={x['userRating']}({x['userCount']}) dens={x['density']} net={x['network']} w={x['warranty']} iss={x['issues'][:3]}")
print('models w/ sv hits',sum(1 for o in R if o['svHitN']), sorted([(o['svHitN'],o['name']) for o in R],reverse=True)[:12])
