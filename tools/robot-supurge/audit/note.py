# Kısa denetim notu kaydet: python3 audit/note.py <id> "<url>" "<not>"
import json,os,sys
S=os.path.dirname(os.path.abspath(__file__))
Q={q['id']:q['q'] for q in json.load(open(S+'/queue.json'))}
i,u,n=sys.argv[1:4]
json.dump({'query':Q.get(i,''),'note':n,'results':[{'url':u,'raw_content':n}]},open(f'{S}/raw/{i}.json','w'),ensure_ascii=False)
