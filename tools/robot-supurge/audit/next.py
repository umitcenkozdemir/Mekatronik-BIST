# Sıradaki N sorguyu mevcut değerlerle bas: python3 audit/next.py 8
import json,os,sys
os.chdir(os.path.dirname(os.path.abspath(__file__))+'/..')
d={o['id']:o for o in json.load(open('robots2.json'))['items']}
Q=json.load(open('audit/queue.json'));RC=json.load(open('audit/recheck.json'))
todo=[q for q in Q if not os.path.exists('audit/raw/'+q['id']+'.json') and q['id'] not in RC]
print('kalan',len(todo))
for q in todo[:int(sys.argv[1]) if len(sys.argv)>1 else 4]:
    o=d[q['id']];print(q['id'],'|',q['q'],'|',[o.get(k) for k in ['nav','obst','mop','selfEmpty','mopWash','hotWash','hotDry','pa','mah']])
