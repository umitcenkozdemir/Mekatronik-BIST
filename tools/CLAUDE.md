# Karşılaştırma Rehberi — devir notu

Bu klasörde iki Türkçe alışveriş rehberi var. Her biri tek dosyalık bir HTML sayfası üretir.

| Rehber | Kaynak klasör | Yayın kopyası | Yayındaki sayfa |
|---|---|---|---|
| Robot süpürge | `tools/robot-supurge` | `public/robot-supurge/index.html` | https://claude.ai/artifact/GvzUtVPJWad8ctgvXCMsL8 |
| Buzdolabı | `tools/buzdolabi` | `public/buzdolabi/index.html` | (buzdolabı artifact'i) |

- Dal: `claude/robot-vacuum-comparison-portal-2g35xg`. PR açılmadı; ana dala birleştirilmedi.
- İletişim dili Türkçe; kullanıcı kısa ve doğrudan yanıt istiyor, eksik bilgi varsa önce kısa soru.

## Durum (10 Kasım 2026)

- **Robot süpürge**: satıştaki 265 modelin hepsi derin incelendi (`profiles.json`). Puanı belirleyen alanlar
  (navigasyon, engel algılama, mop, istasyon, Pa, mAh) 9–10 Kasım'da üretici sayfası / bağımsız incelemeyle
  denetlendi: 85 modelde düzeltme `corrections.json`'da (kanıt `src` alanında). Ayrıntı: `robot-supurge/audit/`.
- **Buzdolabı**: kullanıcı "ben söyleyene kadar hiçbir şey yapma" dedi. Dokunma; günlük görevi kapalı.
- **epey.com** 9 Kasım'dan beri bulut ortamından açılmıyordu (Tavily "Failed to fetch"). Liste/satıcı tazeleme
  yapılamadığı için stok tarihi "5 Kasım 2026, 10:37" olarak tutuldu. Yerel makinede tekrar dene.

## Günlük iş

`robot-supurge/DAILY.md` adım adım anlatıyor (liste tazeleme, satıcılar, özellik tamamlama, derin inceleme,
tutarlılık denetimi `audit/lint.py`, yeniden üretme, yayın, commit). Özet komutlar:

```bash
cd tools/robot-supurge
python3 -I audit/lint.py "$PWD"          # şüpheli özellik kombinasyonları
python3 -I audit/apply.py "$PWD"         # audit/findings.json -> corrections.json
bash rebuild.sh "5 Kasım 2026, 10:37"    # stok kontrol tarihiyle sayfayı üret
```

## Kurallar

- Tahmin yazma: değer kaynakta yoksa `na` listesine gir, kaynağı `specSrc`/`src`'ye yaz.
- Karşılaştırma tabloları, seri sayfaları, başka modelin sayfası ve site menüleri kanıt sayılmaz.
- Yarım veriyle yayınlama. Commit mesajlarına model kimliği yazma.
- Kullanıcının bir kez sohbete yapıştırdığı Tavily API anahtarını asla kullanma veya commit etme
  (değiştirilmesi önerildi). Tavily'yi MCP bağlantısı üzerinden kullan.
- `.gitignore`'daki ham veriler (`raw_detail/`, `deep/*/…json`, `audit/raw/` vb. ~680 MB) repoda yok;
  gerekirse yeniden çekilir. Üretilmiş JSON'lar (details, profiles, robots2, corrections…) repoda.
