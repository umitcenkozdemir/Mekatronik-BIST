# Sıradaki aranacak modellerin sorgularını yazdırır (ham dosyası olan ya da b*.json'da işlenmiş modeller atlanır).
import json,os,sys,glob
S=sys.argv[1];n=int(sys.argv[2]) if len(sys.argv)>2 else 10
Q=json.load(open(S+'/specfill/queries.json'));T=json.load(open(S+'/specfill/todo.json'))
done=set()
for f in glob.glob(S+'/specfill/b*.json'): done|=set(json.load(open(f)))
L=[k for k in T if k not in done and not os.path.exists(f'{S}/specfill/raw/{k}.json')]
print(len(L),'kaldı')
for k in L[:n]: print(k,'|',Q[k])
