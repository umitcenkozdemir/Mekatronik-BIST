# Robot Süpürge Rehberi — veri hattı

Sayfa: `public/robot-supurge/index.html` (tek dosya, veri gömülü; `npm run dev` ile `/robot-supurge/` adresinde açılır).

Veri anlık görüntüsü: 31 Ekim 2026, kaynak epey.com robot süpürge listeleri (390 model, cam robotları hariç).

## Güncelleme adımları
1. epey.com `robot-supurge/N/` liste sayfalarını (fiyatlı ürünler bitene kadar) ve ürün detay sayfalarını Tavily extract ile JSON olarak indirin.
2. `python3 parse_list.py <liste_json_klasörü> list_items.json`
3. `python3 parse_detail.py <detay_json_klasörü> details.json`
4. `RS_WORK=. python3 build.py` → `robots.json` (puan, F/P, Pareto hesaplanır)
5. `template.html` içindeki `/*__DATA__*/` yerine `robots.json` içeriğini koyup `public/robot-supurge/index.html` olarak kaydedin.

Puanlama ayrıntıları sayfadaki "Yöntem" sekmesindedir.
