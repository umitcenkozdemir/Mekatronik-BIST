# İkinci el ilan gözlemlerini (gozlem.json) modellerle birleştirip "mantıklı mı" analizini robots2.json'a 'used' olarak ekler.
# Kullanım: python3 -I ikinciel/build_used.py <çalışma_klasörü>
import json,sys,statistics,os
S=sys.argv[1]
D=json.load(open(S+'/robots2.json')); I={o['id']:o for o in D['items']}
G=json.load(open(S+'/ikinciel/gozlem.json'))
YB=[(640000,2020),(720000,2021),(830000,2022),(895000,2023),(985000,2024),(1050000,2025)]
def year(i):
    for l,y in YB:
        if i and i<l: return y
    return 2026 if i else None
NOW=2026
# yaşa göre makul ikinci el oranı (aynı puandaki sıfırın fiyatına göre)
RATE={0:.80,1:.70,2:.60,3:.50,4:.40}
live=[o for o in I.values() if o['stock']!='yok' and o.get('ver')=='dogrulandi']
def alt_for(o):
    c=[x for x in live if x['score']>=o['score']-2 and x['id']!=o['id'] and (x.get('as') or 0)>=45
       and (o['station']!='Tam istasyon' or x['station']=='Tam istasyon')]
    return min(c,key=lambda x:x['price']) if c else None
obs={}
for row in G['obs']:
    i,p,src,city,note=row[:5]; flag=row[5] if len(row)>5 else ''
    obs.setdefault(i,[]).append(dict(p=p,src=src,city=city,note=note,flag=flag))
out=[]
for i,L in obs.items():
    o=I[i]; yr=year(o['imgId']); age=max(0,NOW-yr) if yr else 4
    used=[x['p'] for x in L if x['flag'] not in ('sifir','kuskulu')]
    if not used: used=[x['p'] for x in L]
    med=int(statistics.median(used)); lo=min(used); hi=max(used)
    newp=o['price'] if (o['stock']!='yok' and o.get('ver')!='tek') else None
    newv=o.get('ver')=='dogrulandi' and newp is not None
    alt=alt_for(o)
    ref=min([v for v in [newp if newv else None, alt['price'] if alt else None] if v]) if (newv or alt) else None
    fair=int(round(ref*RATE.get(min(age,4),.40)/500)*500) if ref else None
    risks=[]
    if age>=3: risks.append(f"{age} yaşında: pil büyük olasılıkla yıpranmış, değişimi bütçeye ekleyin")
    if o['stock']=='yok': risks.append("Artık sıfır satılmıyor: yedek parça ve sarf malzemesi bulunurluğunu kontrol edin")
    if o['brand']=='iRobot': risks.append("iRobot'un mali durumu yedek parça desteğini belirsizleştiriyor")
    if (o.get('as') or 0) and o['as']<45: risks.append(f"Markanın satış sonrası notu düşük ({o['as']}/100)")
    if (o.get('svHitN') or 0)>=5: risks.append(f"Şikâyetvar'da bu model için {o['svHitN']} şikâyet")
    pi=(o.get('prof') or {}).get('issues') or []
    if any('parça' in s.lower() for s in pi): risks.append("Yedek parça bulunamama şikâyetleri var")
    if o['station'] in ('Tam istasyon',) and age>=3: risks.append("İstasyonun pompa, hortum ve ısıtıcısı yaşla arıza çıkarabilir")
    # karar: piyasa (ilanların ortası) ve tek tek ilanlar
    deals=[x for x in L if fair and x['flag'] not in ('sifir','kuskulu') and x['p']<=fair*1.1]
    tl=lambda v:f"{v:,}".replace(',','.')
    if ref is None:
        verdict,why='bilgi','Karşılaştırılacak sıfır model bulunamadı.'
    elif newv and med>=newp*.85 and not deals:
        verdict,why='degmez',(f"Sıfırı {tl(newp)} TL; ilanların ortası ({tl(med)} TL) sıfırından bile pahalı." if med>=newp else f"Sıfırı {tl(newp)} TL; ilanların ortası ({tl(med)} TL) neredeyse aynı.")+" Garantili sıfırını alın."
    elif med<=fair*1.1 and len(risks)<=2:
        save=ref-med; verdict='mantikli'; why=f"İlanların ortası {tl(med)} TL: aynı sınıftaki en ucuz sıfıra göre %{round(save/ref*100)} ({tl(save)} TL) daha ucuz."
    elif deals:
        verdict='pazarlik'; why=f"Piyasa {tl(med)} TL ile pahalı, ama {tl(min(x['p'] for x in deals))} TL'lik ilan makul sınırın ({tl(fair)} TL) içinde."
    elif med<=fair*1.3:
        verdict='pazarlik'; why=f"İlanların ortası {tl(med)} TL; {tl(fair)} TL ve altına inerse mantıklı."
    else:
        a=f"Aynı sınıfta sıfır {alt['name']} {tl(alt['price'])} TL. " if alt and alt['price']<=med*1.15 else ""
        verdict='degmez'; why=a+f"İlanlar ({tl(med)} TL) makul ikinci el fiyatının ({tl(fair)} TL) üstünde."
    for x in L: x['deal']=x in deals
    out.append(dict(id=i,name=o['name'],brand=o['brand'],yr=yr,score=o['score'],station=o['station'],n=len(L),med=med,lo=lo,hi=hi,
        newp=newp,newv=newv,alt=dict(id=alt['id'],name=alt['name'],price=alt['price'],score=alt['score']) if alt else None,
        ref=ref,fair=fair,verdict=verdict,why=why,risks=risks,obs=L))
order={'mantikli':0,'pazarlik':1,'degmez':2,'bilgi':3}
out.sort(key=lambda r:(order[r['verdict']],-r['score']))
D['used']=dict(rows=out,date='1 Kasım 2026',nObs=len(G['obs']),srcs={'letgo':sum(1 for r in G['obs'] if r[2]=='letgo'),'sahibinden':sum(1 for r in G['obs'] if r[2]=='sahibinden')})
json.dump(D,open(S+'/robots2.json','w'),ensure_ascii=False,separators=(',',':'))
import collections
print('used',len(out),collections.Counter(r['verdict'] for r in out))
for r in out: print(r['verdict'],r['name'],r['yr'],r['score'],'med',r['med'],'new',r['newp'],'ref',r['ref'],'fair',r['fair'],'|',r['why'])
