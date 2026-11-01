# Buzdolabı Rehberi — günlük iş

Her gün: (1) listeyi tazele, yeni modelleri bul, (2) sıradaki 30 doğrulanmış modeli derinlemesine incele,
(3) sayfayı yeniden üret, yayınla, repoya gönder.

- Dal: `claude/robot-vacuum-comparison-portal-2g35xg`
- Çalışma klasörü: `tools/buzdolabi` (aşağıda `$W`)
- Kapsam: epey.com'da "Kullanım Tipi: Solo" olan ev tipi buzdolapları. Büro/tezgah tipi, ankastre ve endüstriyel hariç.
- Veriler yalnızca Tavily extract (extract_depth=advanced) ile çekilir; epey adreslerine her gün `?s=<YYYYMMDD>` ekle.
  Büyük çıktılar `~/.claude/projects/.../tool-results/*.txt` dosyasına yazılır; bunları ilgili klasöre kopyala.
- MediaMarkt arama sayfaları buzdolabı sonuçlarını göstermiyor; Amazon buzdolabı neredeyse satmıyor. İkisi atlanır.

## 0. Hazırlık

```bash
git fetch origin claude/robot-vacuum-comparison-portal-2g35xg
git checkout claude/robot-vacuum-comparison-portal-2g35xg && git pull
W=$PWD/tools/buzdolabi; cd $W
B=f$(ls -d deep/f* | wc -l | awk '{print $1+1}')   # bugünün parti adı (f6, f7, ...)
TAG=$(date +%Y%m%d)
```

## 1. Listeyi tazele ve yeni modelleri bul

1. `list/` klasörünü boşalt. `https://www.epey.com/buzdolabi/?s=$TAG` ve `https://www.epey.com/buzdolabi/N/?s=$TAG`
   (N = 2..50; 12–13'lük gruplar) sayfalarını çek, `list/p01.json`, `list/p02.json`... olarak kaydet.
   Bir sayfada fiyatlı ürün kalmadıysa sonraki sayfaları çekmeye gerek yok.
2. `python3 -I parse_list.py list list_items.json` (son satır sayfa başına fiyatlı ürün sayısını gösterir).
3. Yeni modeller = `list_items.json`'da `sites>=2` olup `details.json`'da olmayanlar:
   ```bash
   python3 -I -c "import json;L=json.load(open('list_items.json'));D=json.load(open('details.json'));print(json.dumps([x['url']+'?s=$TAG' for x in L if x['sites']>=2 and x['url'] not in D]))"
   ```
   Bu sayfaları 20'şerli çek, çıktıları `raw_detail/` içine koy, `python3 -I parse_detail.py raw_detail details.json`
   ve `python3 -I sellers.py .` çalıştır. Solo olan yeni modelleri `profile_queue.json`'un sonuna (liste sırasıyla) ekle.
4. Haftada bir (pazartesi) stoktaki tüm modellerin detay sayfalarını yeniden çek (satıcı listeleri tazelenir).

## 2. Derin inceleme (30 model)

1. `python3 -I deep_urls.py $W $B 30` → `deep/$B/queue.json` ve `hb` (model koduyla Hepsiburada araması) ile `tek` (Teknosa) adreslerini basar.
2. `hb` adreslerini çek, birleştirip `deep/$B/hb.json` olarak kaydet (`{"results":[...]}`); `tek` adreslerini `deep/$B/tek.json` olarak kaydet.
3. `python3 -I deep_urls.py $W $B --second` → bulunan ürün sayfalarını ve `-yorumlari` adreslerini basar (paket/çeyiz seti ilanlarını eler).
   Ürün sayfalarını `deep/$B/hb.json`'un `results` listesine ekle; yorum sayfalarını `deep/$B/hbrev.json` olarak kaydet.
4. `python3 -I parse_deep.py $W deep/$B` → `deep/$B/research.json`.
5. `python3 -I dump_evidence.py $W deep/$B` → model başına özellikler, satıcılar, Hepsiburada puan dağılımı, en çok oy alan yorumlar, Şikâyetvar başlıkları.
6. `profiles.json`'a model başına kayıt ekle (`date`: "2 Kasım 2026" gibi; `verdict` 2–3 cümle; `forWho`, `notFor`, `pros`, `cons`, `liked`, `disliked`, `issues`).
   - Her iddia veriye dayanmalı (özellik, mağaza sayfası, puan dağılımı, yorum, Şikâyetvar başlığı). Tek yoruma dayanan bilgi "bir kullanıcıya göre" diye yazılır.
   - Aynı gövdeyi paylaşan kardeş modelleri (ör. Beko 970471 MB / Arçelik 570471 MB, Bosch KGN56VWD0N / Profilo BD3056WDVN / Siemens KG56NCID0N) ve aralarındaki fiyat farkını belirt.
   - Satıcı fiyatı piyasanın çok üstündeyse, büyük mağaza (A101, MediaMarkt, Teknosa, Hepsiburada'nın kendisi) varsa veya ürün sepete eklenemiyorsa açıkça yaz.
7. Ürün sayfasında sınıflandırma hatası (soğutma tipi, buzdolabı tipi, enerji sınıfı, ses) görürsen `corrections.json`'a ekle
   (`cool`, `type`, `ecl`, `db` alanları; `src` alanına kanıtı yaz).

## 3. Yeniden üret, kontrol et, yayınla

```bash
bash rebuild.sh "<gün> <ay> <yıl>, $(TZ=Europe/Istanbul date +%H:%M)"
```

- Playwright ile `buzdolabi.html`'i aç (`<body>` içine koyarak): konsol hatası olmamalı; Liste/Tablo/Analiz/Güvence/Öneriler/Rehber/Yöntem sekmeleri açılmalı;
  yeni profillerden birinin ayrıntı penceresi düzgün görünmeli; 390 px genişlikte yatay kaydırma olmamalı.
- Yayınla: önce `Artifact` read ile buzdolabı sayfasını oku, sonra aynı adrese `Artifact` publish (`file_path` = `$W/buzdolabi.html` kopyası).
- Repoya gönder:
  ```bash
  cd ../.. && git add -A tools/buzdolabi public/buzdolabi
  git commit -m "Buzdolabı Rehberi: günlük güncelleme ($B: 30 model incelendi, N yeni model)"
  git push -u origin claude/robot-vacuum-comparison-portal-2g35xg
  ```
- Kısa özet: incelenen modeller, yeni modeller, stoktan düşenler, düzeltilen sınıflandırmalar, çekilemeyen kaynaklar.

## Kurallar

- Ana liste: en az bir büyük mağaza veya resmi/yetkili satıcıda (adında üretici grubu markası geçen mağaza) bulunan model `dogrulandi`;
  sadece pazar yeri satıcılarında olan `pazaryeri` uyarısıyla kalır; tek pazar yeri satıcısında olan ayrılır.
- Eski model: 2023 veya öncesi (görsel no < 900000) ve sadece 1–2 mağazada.
- Puan, beklenen fiyat ve F/P formülleri `build.py`'de; satış sonrası notu `build_rel.py`'de. Değişirse Yöntem sekmesi metnini de güncelle (`template.html`).
- Sıra bittiğinde en eski tarihli profillerden başlayarak yeniden incele.
