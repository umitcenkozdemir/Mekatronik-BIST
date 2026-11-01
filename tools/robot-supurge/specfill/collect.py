# Tavily search çıktı dosyalarını sorgu metnine göre model kimliğiyle eşleştirip specfill/raw/<id>.json'a kopyalar
import json,glob,os,shutil,sys
S=sys.argv[1]; T='/root/.claude/projects/-home-user-Mekatronik-BIST/5d489f58-382e-58e4-9c80-64cc9ac36d80/tool-results'
Q={v:k for k,v in json.load(open(S+'/specfill/queries.json')).items()}
n=0
for f in glob.glob(T+'/mcp-Tavily-tavily_search-*.txt'):
    try: q=json.load(open(f)).get('query')
    except Exception: continue
    if q in Q:
        dst=f"{S}/specfill/raw/{Q[q]}.json"
        if not os.path.exists(dst): shutil.copy(f,dst); n+=1
print('kopyalanan',n,'toplam',len(glob.glob(S+'/specfill/raw/*.json')))
