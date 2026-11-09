# tool-results içindeki yeni Tavily arama çıktılarını sorgu metnine göre audit/raw/<id>.json olarak kaydeder
import json,glob,os,sys,shutil
S=sys.argv[1]; T=sys.argv[2]
Q={q['q']:q['id'] for q in json.load(open(S+'/audit/queue.json'))}
done=[]
RC=set(json.load(open(S+'/audit/recheck.json'))) if os.path.exists(S+'/audit/recheck.json') else set()
for f in glob.glob(T+'/mcp-Tavily-tavily_search-*.txt'):
    try: j=json.load(open(f))
    except Exception: continue
    i=Q.get(j.get('query'))
    if i and i not in RC and not os.path.exists(S+f'/audit/raw/{i}.json'):
        shutil.copy(f,S+f'/audit/raw/{i}.json'); done.append(i)
print(' '.join(done))
