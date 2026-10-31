# robots2.json'a stoksuz model listesini (oos.json) ve kontrol zamanını ekler
import json,re,sys
S=sys.argv[1]; when=sys.argv[2] if len(sys.argv)>2 else ''
D=json.load(open(S+'/robots2.json')); O=json.load(open(S+'/oos.json'))
import os
IMG=json.load(open(S+'/imgids.json')) if os.path.exists(S+'/imgids.json') else {}
have={o['url'] for o in D['items']}
def n(v):
    if not v or v=='-': return None
    m=re.search(r'([\d.,]+)',v.replace('.','')); return float(m.group(1).replace(',','.')) if m else None
T={'Robot Süpürge+Mop':'Süpürge + Mop','Robot Süpürge':'Sadece süpürge','Robot Mop':'Sadece mop'}
D['oos']=[dict(n=o['name'],b=o['name'].split()[0],t=T.get(o['type'],o['type']),rt=n(o['runtime']),mah=n(o['battery']),pa=n(o['suction']),u=o['url'],i=IMG.get(o['url'])) for o in O if o['url'] not in have]
D['stockChecked']=when
json.dump(D,open(S+'/robots2.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(D['oos']))
