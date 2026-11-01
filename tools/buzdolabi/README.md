# Buzdolabı Rehberi

Türkiye'de satışta olan ev tipi (solo) buzdolaplarını karşılaştıran tek sayfalık rehber. Robot süpürge rehberiyle aynı altyapı.

- Yayındaki sayfanın repo kopyası: `public/buzdolabi/index.html`
- Günlük iş akışı: [DAILY.md](DAILY.md)
- Veri zinciri: `bash rebuild.sh "<kontrol zamanı>"` → `build.py` (özellik puanı, beklenen fiyat, F/P, stok) → `build_rel.py` (marka satış sonrası, Şikâyetvar) → `attach.py` (tek mağazalı ilanlar) → `enrich.py` (satıcı doğrulama, derin inceleme, profiller) → `assemble.py`

| Dosya | İçerik |
|---|---|
| `list_items.json` | epey liste sayfalarından fiyatlı modeller (fiyat, mağaza sayısı, görsel no, hacim) |
| `details.json` | epey ürün sayfalarından teknik özellikler ve satıcılar |
| `offers.json` | satıcı bazında teklifler |
| `sv.json` | Şikâyetvar marka ve buzdolabı kategorisi verisi |
| `profiles.json` | elle yazılan, kanıta dayalı model profilleri |
| `corrections.json` | ürün sayfasından doğrulanan sınıflandırma düzeltmeleri |
| `produrls.json` | modellerin Hepsiburada ürün adresleri |
| `deep/f*/research.json` | derin inceleme ham sonuçları (Hepsiburada ürün ve yorum sayfaları, Teknosa) |
| `data2.json` | sayfaya gömülen nihai veri |

Özellik puanı (0–100): enerji 25, soğutma 20, sessizlik 15, tazelik bölmeleri 15, kullanım 12, akıllı 6, ekstra 7.
Beklenen fiyat: ln(fiyat) ~ ln(hacim) + tip + özellik puanı (en küçük kareler); F/P bu beklentiden sapmanın 0–100 ölçeği.
