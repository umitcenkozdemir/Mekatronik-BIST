# data2.json'a tek mağazalı (ayrıntısı çekilmemiş) ilanları ve kontrol zamanını ekler
import json,sys
S=sys.argv[1]; when=sys.argv[2] if len(sys.argv)>2 else ''
D=json.load(open(S+'/data2.json')); L=json.load(open(S+'/list_items.json')); DT=json.load(open(S+'/details.json'))
have={o['url'] for o in D['items']}
D['lite']=[dict(n=x['name'],b=x['name'].split()[0],p=round(x['price']),s=x['sites'],u=x['url'],i=x.get('img'),v=x.get('tot')) for x in L if x['url'] not in have and x['url'] not in DT]
D['excluded']=sum(1 for u,v in DT.items() if v['specs'].get('Kullanım Tipi')!=['Solo'])
D['stockChecked']=when
json.dump(D,open(S+'/data2.json','w'),ensure_ascii=False,separators=(',',':'))
print('lite',len(D['lite']),'excluded',D['excluded'])
