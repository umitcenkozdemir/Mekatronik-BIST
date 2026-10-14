<?php
declare(strict_types=1);
require __DIR__ . '/../bootstrap.php';

use App\Text;
use App\VehicleRepository;

require_login();

$v = [];
$inspectors = [];
$dbError = null;
try {
    $repo = new VehicleRepository();
    $inspectors = $repo->inspectors();
    if (isset($_GET['id'])) {
        $v = $repo->load((int) $_GET['id']) ?? [];
        $v['findings'] = isset($v['findings']) ? implode("\n", $v['findings']) : '';
    }
} catch (\Throwable $e) {
    error_log('[index] ' . $e->getMessage());
    $dbError = 'Veritabanına bağlanılamadı. Kayıt yapılamaz; yönetici ile iletişime geçin.';
}
$val = static fn(string $k, string $def = '') => Text::h((string) ($v[$k] ?? $def));

/** [alan, etiket, tip, genişlik(col-md)] */
$identity = [
    ['make', 'Marka', 'text', 3], ['commercial_name', 'Ticari Adı', 'text', 5], ['type_code', 'Tipi', 'text', 2],
    ['model_year', 'Model Yılı', 'number', 2], ['vehicle_class', 'Araç Sınıfı', 'text', 2], ['body_type', 'Araç Cinsi', 'text', 3],
    ['door_count', 'Kapı', 'number', 1], ['color', 'Renk', 'text', 3], ['engine_no', 'Motor No', 'text', 3],
];
$tech = [
    ['curb_weight_kg', 'Net Ağırlık (kg)'], ['max_laden_kg', 'Azami Yüklü (kg)'], ['gross_train_kg', 'Katar Ağ. (kg)'],
    ['trailer_braked_kg', 'Römork Frenli (kg)'], ['trailer_unbraked_kg', 'Römork Frensiz (kg)'], ['seat_count', 'Koltuk'],
    ['steering_side', 'Direksiyon'], ['cylinder_count', 'Silindir'], ['displacement_cc', 'Hacim (cc)'],
    ['power_kw', 'Güç (kW)'], ['fuel_type', 'Yakıt'], ['transmission', 'Vites'],
    ['drive_direction', 'Çekiş Yönü'], ['drive_config', 'Çekiş Durumu'], ['emission_level', 'Emisyon'],
    ['length_mm', 'Uzunluk (mm)'], ['width_mm', 'Genişlik (mm)'], ['height_mm', 'Yükseklik (mm)'],
    ['wheelbase_mm', 'Dingil (mm)'], ['tire_size', 'Lastik Ebadı'],
];
$yn = [['has_key', 'Anahtar'], ['has_type_label', 'Tip Onay Etiketi'], ['has_radio', 'Radyo/Teyp'],
       ['has_towbar', 'Çeki Demiri'], ['has_sunroof', 'Sunroof'], ['has_catalytic', 'Katalitik Konvertör']];
?><!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="csrf" content="<?= Text::h(csrf_token()) ?>">
<title>Araç Tespit</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
  .auto { background:#fff8e1 !important; }              /* API'den gelen alan */
  .form-control,.form-select { min-height:44px; }        /* tablet dokunma hedefi */
  #vin { font-family:monospace; font-size:1.3rem; letter-spacing:.08em; text-transform:uppercase; }
  .sticky-bar { position:sticky; bottom:0; background:#fff; border-top:1px solid #ddd; padding:.6rem 0; z-index:5; }
</style></head>
<body class="bg-light"><div class="container py-3" style="max-width:960px">
<div class="d-flex justify-content-between align-items-center mb-3">
  <h5 class="m-0">Araç Tespit Formu</h5>
  <div><a class="btn btn-outline-secondary btn-sm" href="list.php">Kayıtlar</a>
  <a class="btn btn-outline-secondary btn-sm" href="logout.php">Çıkış</a></div>
</div>
<?php if ($dbError): ?><div class="alert alert-danger"><?= Text::h($dbError) ?></div><?php endif; ?>
<div id="alerts"></div>

<form id="f" autocomplete="off" novalidate>
<input type="hidden" name="inspection_id" value="<?= $val('inspection_id') ?>">
<input type="hidden" name="decode_sources" id="decode_sources" value="<?= $val('decode_sources') ?>">

<div class="card mb-3"><div class="card-body">
  <label class="form-label fw-bold" for="vin">Şasi Numarası (VIN)</label>
  <div class="input-group">
    <input class="form-control" id="vin" name="vin" maxlength="17" value="<?= $val('vin') ?>" <?= isset($v['vin']) ? 'readonly' : 'autofocus' ?> inputmode="text" autocapitalize="characters">
    <button type="button" class="btn btn-primary" id="decodeBtn">Sorgula</button>
  </div>
  <div class="form-text"><span id="vinCount">0</span>/17 — 17 hane girilince otomatik sorgulanır. Sorgu başarısız olursa alanları elle doldurun.</div>
</div></div>

<div class="card mb-3"><div class="card-header fw-bold">Kimlik Bilgileri</div><div class="card-body"><div class="row g-2">
<?php foreach ($identity as [$k, $l, $t, $w]): ?>
  <div class="col-6 col-md-<?= $w ?>"><label class="form-label small mb-1"><?= $l ?></label>
  <input class="form-control" type="<?= $t === 'number' ? 'text' : $t ?>" <?= $t === 'number' ? 'inputmode="numeric"' : '' ?> name="<?= $k ?>" value="<?= $val($k) ?>"></div>
<?php endforeach; ?>
</div></div></div>

<div class="card mb-3"><div class="card-header fw-bold">Teknik Veriler</div><div class="card-body"><div class="row g-2">
<?php foreach ($tech as [$k, $l]): ?>
  <div class="col-6 col-md-3"><label class="form-label small mb-1"><?= $l ?></label>
  <input class="form-control" name="<?= $k ?>" value="<?= $val($k) ?>" <?= in_array($k, ['steering_side','fuel_type','transmission','drive_direction','drive_config','emission_level','tire_size'], true) ? '' : 'inputmode="decimal"' ?>></div>
<?php endforeach; ?>
</div></div></div>

<div class="card mb-3"><div class="card-header fw-bold">Saha Tespiti</div><div class="card-body"><div class="row g-2">
  <div class="col-6 col-md-3"><label class="form-label small mb-1">Güncel KM *</label>
    <input class="form-control" name="odometer_km" inputmode="numeric" value="<?= $val('odometer_km') ?>"></div>
  <div class="col-6 col-md-3"><label class="form-label small mb-1">Hasar Oranı (%) *</label>
    <input class="form-control" name="damage_percent" inputmode="numeric" value="<?= $val('damage_percent') ?>"></div>
  <div class="col-6 col-md-3"><label class="form-label small mb-1">Akü Durumu</label>
    <select class="form-select" name="battery_status">
    <?php foreach (['calisiyor' => 'Sağlam / çalışıyor', 'bitik_calisti' => 'Bitik, takviye ile çalıştı', 'bitik_calismadi' => 'Bitik, takviye ile çalışmadı',
                    'bitik_takviyesiz' => 'Bitik, takviye yapılmadı', 'yok' => 'Akü yok'] as $k => $l): ?>
      <option value="<?= $k ?>" <?= ($v['battery_status'] ?? 'calisiyor') === $k ? 'selected' : '' ?>><?= $l ?></option>
    <?php endforeach; ?></select></div>
  <div class="col-6 col-md-3"><label class="form-label small mb-1">Lastik Durumu</label>
    <select class="form-select" name="tire_condition">
    <?php foreach (['iyi' => 'İyi', 'orta' => 'Orta', 'omrunu_doldurmus' => 'Ömrünü doldurmuş'] as $k => $l): ?>
      <option value="<?= $k ?>" <?= ($v['tire_condition'] ?? 'iyi') === $k ? 'selected' : '' ?>><?= $l ?></option>
    <?php endforeach; ?></select></div>
<?php foreach ($yn as [$k, $l]): ?>
  <div class="col-6 col-md-2"><label class="form-label small mb-1"><?= $l ?></label>
    <select class="form-select" name="<?= $k ?>">
      <option value="1" <?= !empty($v[$k]) ? 'selected' : '' ?>>VAR</option>
      <option value="0" <?= empty($v[$k]) ? 'selected' : '' ?>>YOK</option></select></div>
<?php endforeach; ?>
  <div class="col-12"><label class="form-label small mb-1">Çizik / Ezik / Hasar Notları (her satır ayrı cümle)</label>
    <textarea class="form-control" name="findings" rows="5" placeholder="Kaput yüzeyinde ezik bulunmaktadır.&#10;Far camları matlaşmıştır.&#10;Tamponlarında sürtme izleri ve çizikler vardır."><?= $val('findings') ?></textarea></div>
</div></div></div>

<div class="card mb-3"><div class="card-header fw-bold">Rapor Bilgileri</div><div class="card-body"><div class="row g-2">
  <div class="col-12 col-md-5"><label class="form-label small mb-1">Ambar</label>
    <input class="form-control" name="warehouse" id="warehouse" value="<?= $val('warehouse') ?>" placeholder="Burakbey Acarlar Yediemin (Ataşehir)"></div>
  <div class="col-6 col-md-3"><label class="form-label small mb-1">Tespit Tarihi</label>
    <input class="form-control" type="date" name="inspected_at" id="inspected_at" value="<?= $val('inspected_at', date('Y-m-d')) ?>"></div>
  <div class="col-6 col-md-4"><label class="form-label small mb-1">Ekspert</label>
    <select class="form-select" name="inspector_id" id="inspector_id">
    <?php foreach ($inspectors as $i): ?>
      <option value="<?= (int) $i['id'] ?>" <?= (int) ($v['inspector_id'] ?? 0) === (int) $i['id'] ? 'selected' : '' ?>><?= Text::h($i['full_name']) ?></option>
    <?php endforeach; ?></select></div>
</div></div></div>

<div class="sticky-bar"><div class="d-flex gap-2">
  <button class="btn btn-success flex-grow-1 py-2" id="saveBtn" type="submit" <?= $dbError ? 'disabled' : '' ?>>Kaydet</button>
  <a class="btn btn-danger py-2 <?= isset($v['inspection_id']) ? '' : 'd-none' ?>" id="pdfBtn" href="pdf.php?id=<?= $val('inspection_id') ?>">PDF İndir</a>
  <a class="btn btn-outline-primary py-2 d-none" id="nextBtn" href="index.php">Sonraki Araç</a>
</div></div>
</form></div>
<script src="assets/app.js"></script>
</body></html>
