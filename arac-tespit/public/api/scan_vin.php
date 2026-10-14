<?php
declare(strict_types=1);
require __DIR__ . '/../../bootstrap.php';

use App\VinDecoder;
use App\VinScanner;

require_login(true);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['ok' => false, 'error' => 'POST gerekli.'], 405);
}
require_csrf();

$f = $_FILES['photo'] ?? null;
if (!$f || $f['error'] !== UPLOAD_ERR_OK || $f['size'] > 8 * 1024 * 1024) {
    json_out(['ok' => false, 'error' => 'Fotoğraf alınamadı veya 8 MB\'tan büyük.'], 422);
}
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    json_out(['ok' => false, 'error' => 'Yalnızca JPEG/PNG/WebP fotoğraf kabul edilir.'], 422);
}

try {
    $r = (new VinScanner())->scan((string) file_get_contents($f['tmp_name']), $mime);
} catch (\Throwable $e) {
    error_log('[scan_vin] ' . $e->getMessage());
    json_out(['ok' => false, 'error' => $e->getMessage() . ' VIN\'i elle yazabilirsiniz.'], 502);
}
if ($r['vin'] === null) {
    json_out(['ok' => false, 'error' => 'Fotoğrafta şasi numarası okunamadı. Daha yakından, ışık vurmadan tekrar çekin.'], 200);
}
json_out([
    'ok' => true, 'vin' => $r['vin'], 'valid' => VinDecoder::isValid($r['vin']),
    'confidence' => $r['confidence'], 'note' => $r['note'],
]);
