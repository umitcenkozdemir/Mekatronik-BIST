# Resmi/bağımsız kaynak metninden puan alanlarına dair satırları çıkarır
import json,re,sys
PAT={
 'nav':r'lidar|lds|laser distance|dtof|d-tof|tof\b|vslam|navigation type|navigasyon|starsight|lazer',
 'obst':r'obstacle|structured light|rgb|camera|kamera|reactive|aivi|3d|line laser|engel',
 'mop':r'roller mop|ozmo roller|rotating mop|dual (spinning|rotating)|spinning mop|vibrarise|sonic|pad|mop type|rulo|döner',
 'station':r'auto[- ]?empty|self[- ]?empty|dust bag|mop wash|hot water|hot air|dry(ing)?|refill|drain|detergent|dock|station|istasyon',
 'num':r'\d[\d,.]*\s?(pa|mah|min|minutes|mm|db|ml|l)\b',
}
def dig(path,model):
    R=json.load(open(path)).get('results',[])
    out=[]
    for r in R:
        t=(r.get('raw_content') or r.get('content') or '')
        lines=[l.strip() for l in re.split(r'\n+',t) if 3<len(l.strip())<220]
        hits={k:[] for k in PAT}
        for i,l in enumerate(lines):
            ll=l.lower()
            for k,p in PAT.items():
                if re.search(p,ll) and len(hits[k])<8:
                    nxt=lines[i+1] if i+1<len(lines) and len(lines[i+1])<60 else ''
                    hits[k].append(l+(' → '+nxt if nxt and l.endswith(':') or (nxt and len(l)<40) else ''))
        out.append((r['url'],hits))
    return out
if __name__=='__main__':
    for u,h in dig(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else ''):
        print('##',u)
        for k,v in h.items():
            if v: print(' ',k,'|',' || '.join(dict.fromkeys(v)))
