# Derin inceleme adresleri (buzdolabı)
# Kullanım:
#   python3 -I deep_urls.py <W> <batch> [N=30]   -> deep/<batch>/queue.json yazar; 'hb' (model koduyla HB araması) ve 'tek' (Teknosa araması) adreslerini basar
#   python3 -I deep_urls.py <W> <batch> --second -> deep/<batch>/hb.json içindeki arama sayfalarından ürün sayfasını bulur (paket/set ilanlarını eler),
#                                                    produrls.json'a yazar ve ürün + '-yorumlari' adreslerini basar
import json,sys,os,re,urllib.parse
S=sys.argv[1]; B=sys.argv[2]; N=int(sys.argv[3]) if len(sys.argv)>3 and sys.argv[3].isdigit() else 30
D=os.path.join(S,'deep',B); os.makedirs(D,exist_ok=True)
R={o['id']:o for o in json.load(open(S+'/data2.json'))['items']}
P=json.load(open(S+'/produrls.json')) if os.path.exists(S+'/produrls.json') else {}
exec(open(S+'/match.py').read())
def code(o):
    m=re.sub(r'\(.*?\)','',o['model']); return re.sub(r'\b(Beyaz|Siyah|Inox|Gri|Vakum)\b','',m,flags=re.I).strip()
hbq=lambda i:'https://www.hepsiburada.com/ara?q='+urllib.parse.quote_plus(code(R[i])+' buzdolabı')
nm=lambda i: urllib.parse.quote_plus(re.sub(r'\(.*?\)','',R[i]['name']).strip())
BAD=re.compile(r'paket|-set-|seti|ceyiz|dugun|-\d-li-|-\d-lu-')
if '--second' in sys.argv:
    Q=json.load(open(D+'/queue.json'))
    pages={r['url']:r['raw_content'] for r in json.load(open(D+'/hb.json')).get('results',[])}
    out=[];miss=[]
    for i in Q:
        if P.get(i,{}).get('hb'): out+=[P[i]['hb'][0],P[i]['hb'][0]+'-yorumlari']; continue
        t=pages.get(hbq(i),''); k=keyname(R[i]); found=None
        cands=[(m.group(1),m.group(2)) for m in re.finditer(r'\[!\[Image \d+: ([^\]]+)\]\([^)]*\)\]\((https://www\.hepsiburada\.com/[^ )"]+)',t)]
        cands+=[(m.group(1).replace('-',' '),'https://www.'+m.group(0)) for m in re.finditer(r'hepsiburada\.com/([a-z0-9-]+)-p[m]?-[A-Z0-9]+',t)]
        for title,url in cands:
            ct=comp(title); j=ct.find(k); u=url.split('?')[0]
            if j<0 or ACC.search(title) or BAD.search(u) or not nextok(k,ct[j+len(k):]): continue
            found=u; break
        if found: P.setdefault(i,{})['hb']=[found]; out+=[found,found+'-yorumlari']
        else: miss.append(R[i]['name'])
    json.dump(P,open(S+'/produrls.json','w'),indent=1)
    print('# HB ürün sayfası bulunamayan:',miss)
    for x in range(0,len(out),20): print(json.dumps(out[x:x+20]))
    sys.exit()
prof=json.load(open(S+'/profiles.json'))
Q=json.load(open(S+'/profile_queue.json'))
todo=[i for i in Q if i not in prof and i in R and R[i]['stock']!='yok' and R[i].get('ver')=='dogrulandi'][:N]
json.dump(todo,open(D+'/queue.json','w'))
print('# queue:',len(todo),[R[i]['name'] for i in todo])
for name,f in (('hb',hbq),('tek',lambda i:'https://www.teknosa.com/arama/?s='+nm(i))):
    u=[f(i) for i in todo]
    for x in range(0,len(u),20): print(name, json.dumps(u[x:x+20]))
