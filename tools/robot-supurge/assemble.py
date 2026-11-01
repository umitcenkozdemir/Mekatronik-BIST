# template.html + robots2.json -> robot-supurge.html (artifact gövdesi) ve repo sayfası
import sys,os
S=sys.argv[1]; repo_page=sys.argv[2] if len(sys.argv)>2 else None
import json
t=open(S+'/template.html').read()
D=json.load(open(S+'/robots2.json'))
# sayfada yalnızca satıştaki modeller: stokta olmayan eski modeller ve tek satıcılı doğrulanamayanlar çıkarılır
D['hidden']=dict(oos=sum(1 for o in D['items'] if o['stock']=='yok')+len(D.get('oos',[])),tek=sum(1 for o in D['items'] if o['stock']!='yok' and o.get('ver')=='tek'))
# 2024 ve öncesi çıkıp yalnızca pazar yeri satıcılarında kalan modeller: eski stok, fiyatlar güvenilmez -> listeden çıkar
_old_pz=lambda o: o.get('ver')=='pazaryeri' and (o.get('imgId') or 10**9)<985000
D['hidden']['oldpz']=sum(1 for o in D['items'] if o['stock']!='yok' and _old_pz(o))
D['items']=[o for o in D['items'] if o['stock']!='yok' and o.get('ver')!='tek' and not _old_pz(o)]
D['oos']=[]
d=json.dumps(D,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
body=t.replace('/*__DATA__*/',d,1)
open(S+'/robot-supurge.html','w').write(body)
if repo_page:
    head='<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>\n</head>\n<body>\n'
    open(repo_page,'w').write(head+body+'\n</body>\n</html>\n')
print('ok',len(body))
