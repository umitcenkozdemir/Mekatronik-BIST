# Sıradaki N modelin derin inceleme adreslerini üretir.
# Kullanım: python3 deep_urls.py <çalışma_klasörü> <batch_adı> [N=20] [--second] [--pz]
#  - İlk geçiş: deep/<batch>/queue.json yazar ve 6 grup URL basar (epey, hb, hbrev, mm, tek, amz)
#  - --second: ilk geçişte HB ürün linki bulunamayan modeller için research.json'daki hbSearch sonuçlarından ürün+yorum adreslerini basar
import json,sys,os,re,urllib.parse,datetime
S=sys.argv[1]; B=sys.argv[2]; N=int(sys.argv[3]) if len(sys.argv)>3 and sys.argv[3].isdigit() else 20
D=os.path.join(S,'deep',B); os.makedirs(D,exist_ok=True)
R={o['id']:o for o in json.load(open(S+'/robots2.json'))['items']}
P=json.load(open(S+'/produrls.json')) if os.path.exists(S+'/produrls.json') else {}
if '--second' in sys.argv:
    r=json.load(open(D+'/research.json')); out=[]
    for i,x in r.items():
        if 'hb' not in x and x.get('hbSearch'):
            u=x['hbSearch']['url']; P.setdefault(i,{})['hb']=[u]; out+=[u,u+'-yorumlari']
    json.dump(P,open(S+'/produrls.json','w'),indent=1)
    print(json.dumps(out)); sys.exit()
prof=json.load(open(S+'/profiles.json'))
Q=json.load(open(S+'/profile_queue.json'))
if '--pz' in sys.argv:  # yalnızca pazar yerinde satılan (doğrulanmamış) modeller, puana göre
    todo=sorted([i for i,o in R.items() if i not in prof and o.get('ver')=='pazaryeri' and not o.get('gone') and o['stock']!='yok'],key=lambda i:-(R[i]['price'] or 0))[:N]
else:
    todo=sorted([i for i in Q if i not in prof and i in R and R[i]['stock']!='yok' and R[i].get('ver')=='dogrulandi'],key=lambda i:-(R[i]['price'] or 0))[:N]  # en pahalılar önce
json.dump(todo,open(D+'/queue.json','w'))
tag=datetime.date.today().strftime('%Y%m%d')
nm=lambda i: urllib.parse.quote_plus(re.sub(r'\(.*?\)','',R[i]['name']).strip())
G={'epey':[R[i]['url']+'?s='+tag for i in todo],
   'hb':[(P.get(i,{}).get('hb') or ['https://www.hepsiburada.com/ara?q='+nm(i)])[0] for i in todo],
   'hbrev':[P[i]['hb'][0]+'-yorumlari' for i in todo if P.get(i,{}).get('hb')],
   'mm':['https://www.mediamarkt.com.tr/tr/search.html?query='+nm(i) for i in todo],
   'tek':['https://www.teknosa.com/arama/?s='+nm(i) for i in todo],
   'amz':['https://www.amazon.com.tr/s?k='+nm(i) for i in todo]}
print('# queue:',todo)
for k,v in G.items(): print(k, json.dumps(v))
