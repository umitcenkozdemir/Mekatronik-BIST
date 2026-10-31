# template.html + robots2.json -> robot-supurge.html (artifact gövdesi) ve repo sayfası
import sys,os
S=sys.argv[1]; repo_page=sys.argv[2] if len(sys.argv)>2 else None
t=open(S+'/template.html').read(); d=open(S+'/robots2.json').read().replace('</','<\\/')
body=t.replace('/*__DATA__*/',d,1)
open(S+'/robot-supurge.html','w').write(body)
if repo_page:
    head='<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>\n</head>\n<body>\n'
    open(repo_page,'w').write(head+body+'\n</body>\n</html>\n')
print('ok',len(body))
