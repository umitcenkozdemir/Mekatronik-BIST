# İkinci el araştırma merkezi

- `gozlem.json`: ilan gözlemleri (model id, fiyat, kaynak, şehir, not, bayrak). letgo liste sayfaları `parse_letgo.py` ile ayrıştırıldı;
  sahibinden içeriği doğrudan okunamadığı için arama motoru özetlerinden (ilan no ile) elle aktarıldı.
- `build_used.py`: her model için ilanların ortası, makul üst sınır (aynı sınıftaki en ucuz garantili sıfır × yaş oranı) ve karar.
  `rebuild.sh` içinde enrich'ten sonra çalışır; sonuç `robots2.json` → `used`.
- Güncelleme: letgo marka sayfalarını (`ikinci-el-roborock`, `ikinci-el-xiaomi-robot-supurge`, `ikinci-el-ecovacs`, `ikinci-el-dreame-robot-supurge`)
  Tavily extract ile çek, `parse_letgo.py` ile ayrıştır, eşleşenleri `gozlem.json`'a ekle. sahibinden için Tavily search (include_domains sahibinden.com).
