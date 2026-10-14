<?php
declare(strict_types=1);
require __DIR__ . '/../../bootstrap.php';

use App\InspectionInput;
use App\VehicleRepository;

require_login(true);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['ok' => false, 'error' => 'POST gerekli.'], 405);
}
require_csrf();

['data' => $data, 'errors' => $errors] = InspectionInput::fromRequest($_POST);
if ($errors) {
    json_out(['ok' => false, 'errors' => $errors], 422);
}
try {
    $id = (new VehicleRepository())->save($data);
    json_out(['ok' => true, 'inspection_id' => $id, 'pdf' => 'pdf.php?id=' . $id]);
} catch (\Throwable $e) {
    error_log('[save] ' . $e->getMessage());
    json_out(['ok' => false, 'errors' => ['Kayıt sırasında sunucu hatası oluştu.']], 500);
}
