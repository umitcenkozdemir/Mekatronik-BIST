# Araç Tespit ve Değerlendirme Sistemi

Yediemin/gümrük araçları için VIN → teknik veri → "Araç Tespit ve Değerlendirme Formu" (PDF, 2 sayfa).
PHP 8.1+, MySQL 8 / MariaDB, Vanilla JS + Bootstrap 5, mPDF.

## Kurulum
```bash
composer install --no-dev
mysql -u root -p -e "CREATE DATABASE arac_tespit CHARACTER SET utf8mb4 COLLATE utf8mb4_turkish_ci"
mysql -u root -p arac_tespit < database/schema.sql
cp .env.example .env        # DB bilgileri + APP_PASS_HASH
php -r "echo password_hash('SIFRENIZ', PASSWORD_DEFAULT);"   # çıktıyı .env → APP_PASS_HASH
php -S 0.0.0.0:8080 -t public   # geliştirme; üretimde document root = public/
```
`storage/cache` yazılabilir olmalı. Ekspert adı/ünvanı/sicil bilgisi `inspectors` tablosundan gelir;
imza görseli için `storage/signatures/<inspector_id>.png` koyun (PDF'te otomatik kullanılır).

## Yapı
| Dosya | Görev |
|---|---|
| `src/VinDecoder.php`, `src/Vin/*` | Sağlayıcı zinciri: NHTSA vPIC → WMI (çevrimdışı marka) → geçmiş kayıt |
| `src/VehicleRepository.php` | CRUD, arama, aynı model şablonu (VIN ilk 8 hane) |
| `src/InspectionInput.php` | Girdi normalizasyonu/doğrulama |
| `src/PdfReport.php` | 34 madde + durum değerlendirmesi PDF'i |
| `public/index.php` + `assets/app.js` | Tablet formu |
| `public/api/decode.php`, `save.php`, `public/pdf.php`, `list.php` | Uç noktalar |

## Notlar
- NHTSA ABD kaynaklıdır; Renault/Fiat/VW gibi AB/TR araçlarda çoğunlukla sadece marka döner. Bu yüzden
  bir modelin ağırlık/boyut değerleri **ilk araçta bir kez** girilir, aynı VIN ön ekli sonraki araçlara otomatik dolar (sarı alanlar).
- **Kamera ile VIN:** `.env` içine `ANTHROPIC_API_KEY` girin. Telefon fotoğrafı küçültülüp `api/scan_vin.php` ile Claude vision a gider; okunan VIN doğrulanır, "high" güvenli ve geçerliyse otomatik sorgulanır, değilse eksper düzeltir. Kamera için sayfa HTTPS üzerinden açılmalı.
- NHTSA başarısız olursa form çalışmaya devam eder, alanlar elle doldurulur.
