# Ham arama dosyasında regex geçen yerleri kısa bağlamla gösterir. Kullanım: python3 -I g.py <S> <id> <regex> [bağlam]
import json,re,sys
S,k,pat=sys.argv[1:4]; w=int(sys.argv[4]) if len(sys.argv)>4 else 90
for r in json.load(open(f'{S}/specfill/raw/{k}.json')).get('results',[]):
    t=re.sub(r'\s+',' ',r.get('raw_content') or r.get('content') or '')
    hs=[t[max(0,m.start()-w):m.end()+w] for m in re.finditer(pat,t,re.I)][:4]
    if hs: print('#',r['url'][:90]); [print('   ',h) for h in hs]
