# robots2.json'a doğrulama durumu, mağaza teklifleri, derin inceleme profilleri ve satın alma kutularını ekler
import json,glob,re,sys,os
S=sys.argv[1]
D=json.load(open(S+'/robots2.json')); I=D['items']
exec(open(S+'/sellers.py').read().split('out={}')[0].replace("S=sys.argv[1]","pass"))
OFF=json.load(open(S+'/offers.json'))
PROF=json.load(open(S+'/profiles.json')); PROF.pop('_meta',None)
RES={}
for f in sorted(glob.glob(S+'/deep/*/research.json')):
    RES.update(json.load(open(f)))
Q=json.load(open(S+'/profile_queue.json'))
def ver_of(o,offs):
    kinds={x['kind'] for x in offs}
    if kinds & {'retail','brand'}: return 'dogrulandi'
    sellers={norm(x.get('seller') or x.get('store') or '') for x in offs}
    return 'pazaryeri' if len(sellers)>=2 else ('tek' if offs else 'tek')
for o in I:
    r=RES.get(o['id'])
    if r and r.get('offers'):
        offs=r['offers']
    else:
        offs=[]
        for x in OFF.get(o['url'],[]):
            k=classify(x['site'],x['seller'],o['brand'])
            offs.append(dict(store=x['store'],seller=x['seller'] or x['store'],kind=k[0],price=x['price'],age=x.get('age')))
    o['offers']=sorted(offs,key=lambda x:x['price'])[:12]
    o['ver']=ver_of(o,offs) if o['stock']!='yok' else o.get('ver','')
    # buy box from deep research
    if r:
        box=[]; minp=o['price']
        hb=r.get('hb')
        if hb and hb.get('price'):
            box.append(dict(store='Hepsiburada',seller=hb.get('seller'),official=bool(hb.get('official')) or (hb.get('seller')=='Hepsiburada'),price=hb['price'],url=hb['url'],ok=bool(hb.get('buyable')),
                warranty='Türkiye garantili' if hb.get('tr_warranty') else None,high=hb['price']>minp*1.3))
        for a in (r.get('amz') or []):
            if a.get('price'):
                box.append(dict(store='Amazon',seller=None,official=False,price=a['price'],url=a['url'],ok=bool(a['buyable']),warranty=None,high=a['price']>minp*1.3)); break
        for m in (r.get('mm') or []):
            if m.get('price'):
                box.append(dict(store='MediaMarkt',seller='MediaMarkt',official=True,price=m['price'],url=m.get('url') or r.get('mmUrl'),ok=bool(m.get('delivery')),warranty=None,high=m['price']>minp*1.3)); break
        for t in (r.get('tek') or []):
            if t.get('price') and t.get('url'):
                box.append(dict(store='Teknosa',seller='Teknosa',official=True,price=t['price'],url=t['url'],ok=bool(t['buyable']),warranty=None,high=t['price']>minp*1.3)); break
        box.sort(key=lambda b:(not b['ok'],b['price']))
        verified_buy=any(b['ok'] and (b['official'] or b['store'] in('MediaMarkt','Teknosa','Amazon')) for b in box)
        st=hb.get('stars') if hb else None
        o['deep']=dict(box=box,buyOk=verified_buy,stars=st,hbCount=(hb or {}).get('count'),checked=D.get('stockChecked'))
        if verified_buy and o['ver']!='dogrulandi' and o['stock']!='yok': o['ver']='dogrulandi'
    p=PROF.get(o['id'])
    if p: o['prof']=p
D['deepDone']=sum(1 for o in I if o.get('prof'))
D['deepTotal']=len([i for i in Q])
D['corrections']={k:v.get('src') for k,v in json.load(open(S+'/corrections.json')).items() if not k.startswith('_')}
json.dump(D,open(S+'/robots2.json','w'),ensure_ascii=False,separators=(',',':'))
import collections
print(collections.Counter(o['ver'] for o in I if o['stock']!='yok'),'deep',D['deepDone'],'/',D['deepTotal'],'size',len(json.dumps(D,ensure_ascii=False,separators=(',',':'))))
print([(o['name'],[(b['store'],b['price'],b['ok']) for b in o['deep']['box']]) for o in I if o.get('deep')][:3])
