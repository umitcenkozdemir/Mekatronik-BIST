<?php
declare(strict_types=1);
require __DIR__ . '/../bootstrap.php';

use App\PdfReport;
use App\VehicleRepository;

require_login();
$id = (int) ($_GET['id'] ?? 0);
try {
    $v = (new VehicleRepository())->load($id);
    if (!$v) {
        http_response_code(404);
        exit('Kayıt bulunamadı.');
    }
    $root = dirname(__DIR__);
    $pdf = (new PdfReport($root . '/storage/cache', $root . '/storage/signatures'))->render($v);
} catch (\Throwable $e) {
    error_log('[pdf] ' . $e->getMessage());
    http_response_code(500);
    exit('PDF üretilemedi.');
}
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="arac-tespit-' . $v['vin'] . '.pdf"');
header('Content-Length: ' . strlen($pdf));
echo $pdf;
