# Robot Süpürge Rehberi — günlük iş

Her gün: (1) listeyi tazele, yeni modelleri bul, (2) profili olmayan modelleri derinlemesine incele (1 Kasım 2026 itibarıyla satıştaki 270 modelin tamamı incelendi; artık yalnızca yeni çıkan modeller kalıyor),
(3) sayfayı yeniden üret, yayınla, repoya gönder.

- Dal: `claude/robot-vacuum-comparison-portal-2g35xg`
- Çalışma klasörü: `tools/robot-supurge` (aşağıda `$W`)
- Yayındaki sayfa: https://claude.ai/artifact/GvzUtVPJWad8ctgvXCMsL8
- Veri kaynakları yalnızca Tavily extract ile çekilir (epey.com ve mağazalar bu ortamdan doğrudan erişilemez).
  Tavily sonuçları önbelleğe alır: epey adreslerine her gün benzersiz bir `?s=<YYYYMMDD>` parametresi ekle.
  Büyük çıktılar `~/.claude/projects/.../tool-results/*.txt` dosyasına yazılır; bunları ilgili klasöre kopyala.

## 0. Hazırlık

```bash
git fetch origin claude/robot-vacuum-comparison-portal-2g35xg
git checkout claude/robot-vacuum-comparison-portal-2g35xg && git pull
W=$PWD/tools/robot-supurge; cd $W
B=d$(ls -d deep/d* | wc -l | awk '{print $1+1}')   # bugünün batch adı (d2, d3, ...)
TAG=$(date +%Y%m%d)
```

## 1. Listeyi tazele ve yeni modelleri bul

1. Tavily extract (extract_depth=advanced) ile `https://www.epey.com/robot-supurge/N/?s=$TAG` sayfalarını çek
   (N = boş (ilk sayfa), 2..22; 10–11'lik iki grup). Çıktıları `list2/a.json`, `list2/b.json` olarak kaydet.
2. `python3 -I parse_list.py list2 list_items2.json` (fiyatlı ürünler bu sayfalarla bitiyorsa yeterli; son sayfada hâlâ fiyatlı ürün varsa 23+ sayfaları da çek).
3. Görsel numaraları: `list2` içinden `resim.epey.com/<id>/...)](<ürün url>)` eşleşmelerini `imgids.json`'a ekle (eski kayıtları silme).
4. Yeni modeller = `list_items2.json`'da olup `details.json`'da olmayan robot süpürgeler (Cam Temizleme Robotu hariç).
   Bunların epey ürün sayfalarını (`<url>?s=$TAG`) çek, çıktıları `raw_detail/` içine koy,
   `python3 -I parse_detail.py raw_detail details.json` (mevcut kayıtları korur, yenileri ekler).
   Yeni modelleri `profile_queue.json`'a popülerlik sırasına göre ekle (liste sayfasındaki sırası).
5. `python3 -I parse_oos.py $W` (fiyatsız eski modeller listesi).

## 1a. Satıcı listelerini tazele (her gün)

Kart fiyatı günlük listeden, ayrıntı penceresindeki mağaza listesi ise ürün sayfasından gelir. İkisi farklı günlerden olursa
kartta görünen fiyat mağaza listesinde bulunmaz. Bu yüzden her gün:
1. Kart fiyatı en ucuz mağaza fiyatının %5'ten fazla altında kalan (kart fiyatı mağaza listesinde bulunmayan) modellerin epey ürün sayfalarını (`<url>?s=$TAG`) 10'arlı çek.
2. Ayrıca satıcı listesi en eski olan 30 modeli (offers_meta.json'da tarihi en eski ya da hiç olmayan) çek.
3. Çıktıları `raw_detail/` içine koy ve `python3 -I sellers.py $W` çalıştır. `offers_meta.json` her sayfanın çekilme tarihini tutar;
   `enrich.py` 2 Kasım 2026 sonrası çekilen listeyi derin incelemedeki eski listenin yerine kullanır ve kutudaki mağaza fiyatlarını günceller.
   Tek satıcısı olup fiyatı yalnız 9'lardan oluşan (99.999 TL gibi) ilanlar yer tutucu fiyattır; build.py bunları stokta yok sayar.
   Tavily bazen mağaza logolarını döndürmez; o zaman satıcı adları ayrıştırılır, mağaza "?" olur.

## 1b. Özellik tamamlama (her gün 20 model, en pahalıdan)

Hedef: hiçbir modelde boş özellik kalmaması. `spec_gaps.json` eksik alanları en pahalı modelden başlayarak listeler
(rebuild sonrası yeniden üretilir). Sıradaki 20 model için üretici sayfası ve bağımsız incelemelerden (Tavily search) değer bul,
`specfill/bN.json` dosyasına yaz: `{id: {alan: değer, "na": [aranıp bulunamayan alanlar], "specSrc": "kaynak"}}`.
Alanlar: pa (Pa), mah, rt (dk), ch (saat), db, dust (ml), water (ml), h (mm), kg, climb (mm), stDust/stClean/stDirty (L), sides.
Kaynakta bulunamayan değerler "na" listesine girer; sayfada "Üretici açıklamıyor" yazar. Tahmin yazma.

## 2. Derin inceleme (20 model)

1. `python3 -I deep_urls.py $W $B 20` → 6 grup adres basar ve `deep/$B/queue.json` yazar.
   Sıra en pahalı modelden ucuza doğrudur. Kuyruk boşsa yalnızca pazar yerinde satılanlar için `--pz` ekle. İkisi de boşsa bu adımı atla.
   Sayfada yalnızca satıştaki modeller gösterilir (stokta olmayan eski modeller ve tek satıcılılar assemble.py'de çıkarılır).
2. Her grubu Tavily extract (advanced) ile çek, çıktıları `deep/$B/{epey,hb,hbrev,mm,tek,amz}.json` olarak kaydet.
3. `python3 -I parse_deep.py $W deep/$B` → `deep/$B/research.json` ve özet satırları.
4. HB ürün linki olmayanlar için: `python3 -I deep_urls.py $W $B --second` → basılan adresleri çek,
   `deep/$B/hb.json` ve `hbrev.json` içeriklerine ekle (results listesine), `parse_deep.py`'ı tekrar çalıştır.
5. Her model için `research.json` içindeki yorumları oku (yararlı oyu yüksek olanlar önce; 1 yıldızlıları atlama),
   robot özelliklerini `robots2.json`'dan, Şikâyetvar başlıklarını (`svHits`) ve marka bilgisini (`brands`) incele.
6. `profiles.json`'a model başına bir kayıt ekle. Alanlar ve yazım kuralları:
   - `date`: bugünün tarihi ("1 Kasım 2026" gibi)
   - `verdict`: 2–3 cümle. Kimin için iyi, neyi eksik, satın alırken neye dikkat.
   - `forWho`, `notFor`, `pros`, `cons`: 2–4 madde. `liked`, `disliked`: kullanıcı yorumlarından; yorum yoksa boş liste.
   - `issues`: Şikâyetvar veya yorumlarda tekrar eden arıza/servis konuları.
   - Her iddia bir veriye dayanmalı: teknik özellik, mağaza sayfası, puan dağılımı, yorum veya Şikâyetvar başlığı.
     Uydurma rakam yazma. Tek bir yoruma dayanan bilgiyi "bir kullanıcıya göre" diye belirt.
   - Satın alınabilirlik: sepete eklenebilir değilse, satıcı pazar yeriyse ya da fiyat piyasanın çok üstündeyse açıkça yaz.
7. Ürün sayfasında sınıflandırmanın yanlış olduğunu gördüysen (mop tipi, engel algılama, kamera, navigasyon)
   `corrections.json`'a ekle (`src` alanına kanıtı yaz).

## 2a. Tutarlılık denetimi (her gün; epey verisine körü körüne güvenme)

Puanı belirleyen alanlar (nav, obst, mop, selfEmpty, mopWash, hotWash, hotDry, refill, deterg, pa, mah) epey'den gelir ve
epey'de eksik/yanlış etiket sık görülür (ör. T80S'de LiDAR ve kamera yazmıyordu). 9 Kasım 2026'da 265 modelin tamamı
üretici sayfası / bağımsız incelemeyle denetlendi (`audit/`). Her gün:

1. **Yeni modeller**: Bugün eklenen her model için `audit/queue.json`'a kayıt ekle (`python3 -I audit/queue.py` yeni id'leri ekler),
   üretici sayfasını Tavily search ile bul (`include_raw_content` KULLANMA; kısa özetler yeter, gerekiyorsa tek sayfayı
   `tavily_extract` + `query` ile oku) ve şu alanları doğrula: navigasyon, engel algılama, mop tipi, istasyon özellikleri, Pa, mAh.
2. **Kural ihlali taraması**: `python3 -I audit/lint.py $W` — şüpheli kombinasyonları listeler
   (ör. aynı seride kardeş modelle farklı nav/obst; "AI/Vision/kamera" geçen adda Tampon; "Omni/Ultra" adında mopWash yok;
   "Plus" adında selfEmpty yok; 10000 Pa üstü ama nav Rastgele/Jiroskop). Her satırı kaynağa bakarak çöz.
3. **Rotasyon**: `audit/raw/` içinde en eski tarihli 10 modeli yeniden kontrol et (ürün yazılım/sayfa güncellemeleri).
4. Bulguyu `python3 -I audit/rec.py <id> alan=değer ... "kaynak açıklaması"` ile kaydet, `python3 -I audit/apply.py $W` ile
   `corrections.json`'a işle. Kanıt yoksa değeri değiştirme; kaynak bulunamayanı `audit/note.py <id> - "not"` ile işaretle.
5. Karar kuralları: lazerle mesafe ölçen her navigasyon (LDS, gömülü/geri çekilir dToF, StarSight, Mini-ToF) → LiDAR;
   RGB/RGBD/AI kamera ile nesne tanıma → "Yapay zekâ / kamera"; yapısal ışık / çizgi lazer / 3D ToF / TrueDetect 3D → "3D / yapısal ışık";
   yalnız kızılötesi/ToF mesafe sensörü → "Temel sensör"; sadece tampon → "Tampon". İleri-geri (reciprocating) ovalayan mop → "Titreşimli".
   Karşılaştırma tabloları, başka modelin sayfası, seri sayfası ve menü metinleri kanıt sayılmaz.
6. Kısa özette düzeltilen model ve alan sayısını belirt.

## 3. Yeniden üret, kontrol et, yayınla

```bash
bash rebuild.sh "$(date '+%-d') $(date '+%B %Y' | sed 's/January/Ocak/;s/February/Şubat/;s/March/Mart/;s/April/Nisan/;s/May/Mayıs/;s/June/Haziran/;s/July/Temmuz/;s/August/Ağustos/;s/September/Eylül/;s/October/Ekim/;s/November/Kasım/;s/December/Aralık/'), $(TZ=Europe/Istanbul date +%H:%M)"
```

- Sayfayı Playwright ile aç (`robot-supurge.html`, `<body>` içine koyarak), konsol hatası olmadığını, Liste/Tablo/Analiz/
  Güvence/Öneriler/Rehber sekmelerinin açıldığını ve yeni profillerden birinin ayrıntı penceresinin düzgün göründüğünü kontrol et.
- Yayınla: önce `Artifact` read ile https://claude.ai/artifact/GvzUtVPJWad8ctgvXCMsL8 sayfasını oku, sonra
  `Artifact` publish (url = aynı adres, file_path = `$W/robot-supurge.html`).
- Repoya gönder:
  ```bash
  cd ../.. && git add -A tools/robot-supurge public/robot-supurge
  git commit -m "Robot Süpürge Rehberi: günlük güncelleme ($B: 20 model incelendi, N yeni model)"
  git push -u origin claude/robot-vacuum-comparison-portal-2g35xg
  ```
- Kısa bir özet bırak: incelenen modeller, yeni bulunan modeller, stoktan düşenler, düzeltilen sınıflandırmalar,
  çekilemeyen kaynaklar.

## Kurallar

- Ana listede kalma: bilinen marka ve en az bir büyük mağaza veya resmi satıcıda stok (`ver=dogrulandi`);
  sadece pazar yeri satıcılarında olanlar uyarıyla kalır; tek pazar yeri satıcısında olanlar ayrılır (`enrich.py`).
- Eski model: 2023 veya öncesi çıkmış (görsel no < 900000) ve sadece 1–2 mağazada kalmış, ya da hiçbir mağazada fiyatı yok.
- Satış sonrası notu, özellik puanı ve F/P formülleri `build.py` / `build_rel.py` içinde; değiştirme gerekirse Yöntem
  sekmesindeki metni de güncelle.
- Sıra bittiğinde (tüm doğrulanmış modeller incelendiğinde) en eski tarihli profillerden başlayarak yeniden incele.
