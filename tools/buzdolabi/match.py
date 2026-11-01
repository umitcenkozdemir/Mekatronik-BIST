# Buzdolabı model kodu eşleştirme yardımcıları (parse_deep.py içine exec edilir)
import re
ACC=re.compile(r'uyumlu|yedek|filtre|conta|\braf\b|rafı|kulp|parça|parca|aparat|kılıf|sticker|koruyucu|kapak|termostat|fan motoru|kompresör kartı|için\b|compatible|replacement|paket|\bset\b|seti|çeyiz|ceyiz|düğün|dugun|\d+\s*[\'’]?\s*l[iıuü]\b',re.I)
STRIP=re.compile(r'buzdolab[ıi]|no ?frost|nofrost|beyaz|siyah|inox|gri|wi-?fi|kombi|combi|e[sş]ya|d[üu]z',re.I)
def comp(s):
    s=s.lower().replace('ı','i').replace('ş','s').replace('ç','c').replace('ğ','g').replace('ö','o').replace('ü','u').replace('İ','i')
    s=STRIP.sub(' ',s)
    return re.sub(r'[^a-z0-9]','',s)
def keyname(o):
    return comp(re.sub(r'\(.*?\)','',o['model'] or o['name']))
def nextok(k,after):
    # anahtar rakamla bitiyorsa devamı rakam olmamalı (DBD200 ≠ DBD2001); harfle bitiyorsa hacim vb. rakam gelebilir
    return not (k[-1:].isdigit() and after[:1].isdigit())
