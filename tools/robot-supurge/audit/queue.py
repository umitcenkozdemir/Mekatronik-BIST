# Satıştaki modeller için resmi kaynak sorgu kuyruğu (en pahalıdan)
import json,sys
S=sys.argv[1]
DOM={'Roborock':['roborock.com','global.roborock.com','us.roborock.com'],'Dreame':['dreametech.com','dreame.tech'],'Ecovacs':['ecovacs.com'],
'Xiaomi':['mi.com'],'Philips':['philips.com','philips.com.tr','versuni.com'],'Mova':['mova.tech','mova-tech.com'],'iRobot':['irobot.com','irobot.com.tr'],
'Narwal':['narwal.com'],'Tefal':['tefal.com','tefal.com.tr'],'Karcher':['kaercher.com'],'Anker':['eufy.com'],'Ezviz':['ezviz.com'],'Bosch':['bosch-home.com','bosch-home.com.tr'],
'DJI':['dji.com'],'Dyson':['dyson.com','dyson.com.tr'],'TP-Link':['tp-link.com'],'Electrolux':['electrolux.com.tr','electrolux.com'],'Samsung':['samsung.com'],
'Lydsto':['lydsto.com'],'Cecotec':['cecotec.com','storececotec.com'],'Ultenic':['ultenic.com'],'Hobot':['hobot.com.tw','hobot.com'],'Viomi':['viomi.com'],
'Beko':['beko.com.tr'],'Arçelik':['arcelik.com.tr'],'Grundig':['grundig.com.tr','grundig.com'],'Fakir':['fakir.com.tr'],'Homend':['homend.com.tr','homend.com'],
'Hoover':['hoover.com.tr','hoover-home.com'],'TCL':['tcl.com'],'Blaupunkt':['blaupunkt.com'],'Mamibot':['mamibot.com']}
d=sorted([o for o in json.load(open(S+'/robots2.json'))['items'] if o['stock']!='yok' and o.get('ver')!='tek'],key=lambda o:-o['price'])
# mevcut kuyruğu koru (elle düzeltilmiş sorgular kaybolmasın), yalnızca yeni modelleri ekle
import os
F=S+'/audit/queue.json'; Q=json.load(open(F)) if os.path.exists(F) else []
have={q['id'] for q in Q}
new=[dict(id=o['id'],q=f"{o['brand']} {o['model']} specifications",dom=DOM.get(o['brand'])) for o in d if o['id'] not in have]
Q+=new
json.dump(Q,open(F,'w'),ensure_ascii=False,indent=0)
print('kuyruk',len(Q),'yeni',len(new),[q['id'] for q in new])
