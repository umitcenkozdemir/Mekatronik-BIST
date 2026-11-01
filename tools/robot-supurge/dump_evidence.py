# Derin inceleme kanıt dökümü. Kullanım: python3 -I dump_evidence.py <W> deep/<batch>
import json,sys
S=sys.argv[1]; D=sys.argv[2]
R={o['id']:o for o in json.load(open(S+'/robots2.json'))['items']}
rs=json.load(open(D+'/research.json'))
K=['price','sites','stock','imgId','pa','rt','h','climb','nav','obst','mop','mopLift','mopExt','station','hotWash','hotDry','refill','deterg','brushExt','tangle','score','fp','pareto','ur','urc','as']
for i,r in rs.items():
    o=R[i]; print('='*80); print(i,'|',o['name'],'|',o['brand'])
    print(' ',{k:o.get(k) for k in K})
    if o.get('svHits'): print('  SV:',o.get('svHitN'),o['svHits'][:3])
    offs=sorted(r.get('offers') or o.get('offers') or [],key=lambda x:x['price'])
    print('  OFF:',[(x['store'],(x.get('seller') or '')[:18],x['kind'][0],int(x['price'])) for x in offs[:6]],sorted({x['kind'] for x in offs}))
    h=r.get('hb') or {}
    if h.get('seller'): print('  HB:',h.get('seller'),h.get('price'),'buy',h.get('buyable'),'tr',h.get('tr_warranty'),'stars',h.get('stars'),'others',[(x['seller'][:15],x['price']) for x in h.get('others',[])][:2])
    if r.get('mm'): print('  MM:',[(m['price'],m['delivery']) for m in r['mm']])
    if r.get('tek'): print('  TEK:',[(t['price'],t['buyable']) for t in r['tek']])
    a=[(x['price'],x['buyable'],x.get('count')) for x in r.get('amz',[]) if x.get('price')]
    if a: print('  AMZ:',a)
    for v in sorted(h.get('reviews',[]),key=lambda v:-v['up'])[:5]: print('   R+%d'%v['up'],v['text'][:200].replace('\n',' '))
