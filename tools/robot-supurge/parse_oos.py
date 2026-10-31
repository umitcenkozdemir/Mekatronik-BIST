import json,re,glob,sys
S=sys.argv[1]; TYPES=['Robot Süpürge+Mop','Robot Süpürge','Robot Mop','Cam Temizleme Robotu']
priced={x['url'] for x in json.load(open(S+'/list_items2.json'))}
out={}
for f in glob.glob(S+'/list2/*.json'):
    for r in json.load(open(f))['results']:
        page=r['url'].split('?')[0]
        lines=r['raw_content'].split('\n')
        for i,l in enumerate(lines):
            m=re.match(r'\*\s+\[!\[Image \d+: [^\]]*\]\([^)]*\)\]\((https://www\.epey\.com/robot-supurge/[^ ]+\.html) "([^"]+)"\)',l)
            if not m: continue
            url,full=m.groups()
            if url in priced: continue
            typ=next((t for t in TYPES if full.endswith(t)),'')
            if typ=='Cam Temizleme Robotu' or not typ: continue
            name=full[:-len(typ)].strip()
            vals=[];j=i+1
            while j<len(lines) and len(vals)<4:
                s=lines[j].strip()
                if s.startswith('*') and 'Image' not in s: vals.append(s[1:].strip())
                elif s.startswith('*'): break
                j+=1
            out[url]=dict(name=name,url=url,type=typ,runtime=vals[0] if vals else None,battery=vals[2] if len(vals)>2 else None,suction=vals[3] if len(vals)>3 else None,page=page)
json.dump(list(out.values()),open(S+'/oos.json','w'),ensure_ascii=False)
print(len(out)); import collections; print(collections.Counter(o['name'].split()[0] for o in out.values()).most_common(25))
print([o['name'] for o in out.values()][:40])
