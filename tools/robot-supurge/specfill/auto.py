# Model başlıklı sonuçlarda eksik alanlara ait anahtar kelimeleri kısa bağlamla gösterir.
import json,re,sys
S=sys.argv[1]; ids=sys.argv[2:]
G=json.load(open(S+'/spec_gaps.json'));d={o['id']:o for o in json.load(open(S+'/robots2.json'))['items']}
KW={'rt':r'run ?time|running time|battery life|minutes|\bmin\b','ch':r'charg\w* time|full(y)? charge|recharg','db':r'\d\d(\.\d)? ?dB\b','kg':r'weigh|\bkg\b|\blbs?\b',
'water':r'water tank|water box|\d{2,3} ?ml','dust':r'dust ?(bin|box|container)|\d{3} ?ml','climb':r'threshold|climb|obstacle cross','mah':r'mAh','h':r'height|\d{2,3}(\.\d)? ?mm',
'stDust':r'dust bag|bag capacity','stClean':r'clean water','stDirty':r'dirty water|waste water|used water','sides':r'side brush','pa':r'\d[\d,.]* ?Pa\b'}
for k in ids:
    try: R=json.load(open(f'{S}/specfill/raw/{k}.json')).get('results',[])
    except Exception: print('==',k,'HAM YOK'); continue
    key=[t for t in re.split(r'[^a-z0-9]+',re.sub(r'\(.*?\)','',d[k]['model']).lower()) if t]
    gp=G.get(k,[]); pat='|'.join(KW[f] for f in gp if f in KW)
    print('==',k,gp)
    for r in R:
        h=re.sub(r'[^a-z0-9]','',(r.get('title','')+' '+r['url']).lower())
        if not all(t in h for t in key): continue
        t=re.sub(r'\s+',' ',r.get('raw_content') or r.get('content') or '')
        t=re.sub(r'!\[[^\]]*\]\([^)]*\)|\([^)]*(https?:|//)[^)]*\)','',t)
        hs=[];last=-999
        for m in re.finditer(pat,t,re.I):
            if m.start()-last<120: continue
            last=m.start(); hs.append(t[max(0,m.start()-70):m.end()+60])
            if len(hs)>=5: break
        if hs:
            print(' #',r['url'][:80])
            for x in hs: print('    ',x)
