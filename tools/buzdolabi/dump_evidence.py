# Derin inceleme kanıt dökümü (profil yazmak için). Kullanım: python3 -I dump_evidence.py <W> deep/<batch>
import json,sys
S=sys.argv[1]; D=sys.argv[2]
R={o['id']:o for o in json.load(open(S+'/data2.json'))['items']}; B=json.load(open(S+'/data2.json'))['brands']
rs=json.load(open(D+'/research.json'))
for i,r in rs.items():
    o=R[i]; b=B.get(o['brand'],{})
    f=[k for k in ('zero','humid','multi','convert','wifi','ai','display','fastF','fastC','holiday','alarm','ice','autoIce','water','rev','lock') if o.get(k)]
    print('='*90); print(f"{i} | {o['name']} | {o['price']} TL | {o['sites']} site | ver={o.get('ver')} | yr≈{o.get('year')}")
    print(f"  {o['type']} | {o['cool']} | {o['tot']} L ({o['coolL']}/{o['frzL']}) | {o['ecl']} {o['kwh']}kWh | {o['db']}dB | {o['w']}x{o['h']}x{o['d']} | comp={o['comp']} | feats={f} fresh={o['fresh']} | score={o['score']} fp={o['fp']} dev={o['dev']}% exp={o['expP']} pareto={o['pareto']} as={o['as']}")
    offs=sorted(r.get('offers') or o.get('offers') or [],key=lambda x:x['price'])
    print('  OFF:',[(x['store'],(x.get('seller') or '')[:22],x['kind'][0],int(x['price'])) for x in offs[:6]], '| kinds', sorted({x['kind'] for x in offs}))
    h=r.get('hb') or {}
    if h: print('  HB:',(h.get('seller') or '')[:30],'price',h.get('price'),'buy',h.get('buyable'),'tr',h.get('tr_warranty'),'stars',h.get('stars'),'others',[(x['seller'][:18],x['price']) for x in h.get('others',[])][:3])
    t=r.get('tek') or []
    if t: print('  TEK:',[(x['price'],x['buyable']) for x in t])
    for v in sorted(h.get('reviews',[]),key=lambda v:-v['up'])[:6]: print('   R+%d'%v['up'],v['text'][:230].replace('\n',' '))
    if o.get('svHits'): print('  SV:',o['svHits'][:3])
