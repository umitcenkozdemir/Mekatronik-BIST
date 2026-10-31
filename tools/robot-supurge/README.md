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

## Güvence verisi (kullanıcı puanı, şikâyet, servis)
6. Şikâyetvar marka sayfaları ve `/<marka>/robot-supurge?page=N` sayfalarını `sv/` klasörüne indirin → `python3 parse_sv.py <klasör>` → `sv.json`
7. Hepsiburada (`/ara?q=<marka> robot süpürge&sayfa=N`) ve Amazon (`/s?k=...&page=N`) arama sayfalarını `hb/` ve `am/` klasörlerine indirin → `python3 parse_rate2.py <klasör>` → `ratings.json`
8. `python3 build_rel.py <klasör>` → `robots2.json` (marka karnesi, şikâyet konuları, satış sonrası notu; servis/garanti bilgisi betikteki `SVC` tablosunda, kaynaklarıyla)
9. `template.html` içindeki `/*__DATA__*/` yerine `robots2.json` koyun.

## Stok kontrolü
10. Liste sayfalarını önbelleği atlatmak için benzersiz bir parametreyle yeniden indirin (ör. `https://www.epey.com/robot-supurge/N/?s=<tarih>`, N=1..22) → `list2/` → `python3 parse_list.py list2 list_items2.json`
11. `build.py` taze listeyi (`list_items2.json`) kullanır: 3+ mağaza "stokta", 1–2 "sınırlı", önceki listede olup tazede olmayan "stok yok".
12. `python3 parse_oos.py <klasör>` → `oos.json` (arka sayfalardaki fiyatsız modeller); `python3 build_rel.py <klasör>` sonrası `python3 attach_oos.py <klasör> "31 Ekim 2026, 18:40"`.
13. Eski model kuralı (`build.py`): epey görsel numarası (`imgids.json`, liste sayfalarından) 900.000'in altındaysa (yaklaşık 2023 sonu öncesi kataloğa eklenmiş) ve model sadece 1–2 mağazada kalmışsa "eski model" sayılır.
