<?php
declare(strict_types=1);
require __DIR__ . '/../../bootstrap.php';

use App\VehicleRepository;
use App\VinDecoder;

require_login(true);
$vin = VinDecoder::normalize((string) ($_GET['vin'] ?? ''));
if (!VinDecoder::isValid($vin)) {
    json_out(['ok' => false, 'error' => 'Şasi numarası 17 haneli olmalı (I, O, Q kullanılamaz).'], 422);
}

$warnings = [];
$repo = null;
try {
    $repo = new VehicleRepository();
    $existing = $repo->findByVin($vin);
    if ($existing) {
        json_out(['ok' => true, 'exists' => true] + $existing);
    }
} catch (\Throwable $e) {
    error_log('[decode] db: ' . $e->getMessage());
    $warnings[] = 'Veritabanı erişilemedi; geçmiş kayıt kontrolü yapılamadı.';
}

$res = (new VinDecoder())->decode($vin);
$fields = $res['fields'];
unset($fields['engine_model']);
$sources = $res['sources'];

// API'nin vermediği alanları aynı modelin önceki kaydından tamamla
if ($repo) {
    try {
        $tpl = $repo->findTemplate($vin);
        if ($tpl) {
            $before = count($fields);
            $fields += $tpl;
            if (count($fields) > $before) {
                $sources[] = 'gecmis-kayit';
            }
        }
    } catch (\Throwable $e) {
        error_log('[decode] template: ' . $e->getMessage());
    }
}

json_out([
    'ok' => true, 'exists' => false, 'fields' => $fields, 'sources' => $sources,
    'warnings' => array_merge($warnings, $res['warnings']),
]);
