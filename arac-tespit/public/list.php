<?php
declare(strict_types=1);
require __DIR__ . '/../bootstrap.php';

use App\Text;
use App\VehicleRepository;

require_login();
$q = trim((string) ($_GET['q'] ?? ''));
$page = max(1, (int) ($_GET['p'] ?? 1));
$per = 25;
$err = null;
$res = ['rows' => [], 'total' => 0];
try {
    $res = (new VehicleRepository())->search($q, $per, ($page - 1) * $per);
} catch (\Throwable $e) {
    error_log('[list] ' . $e->getMessage());
    $err = 'Veritabanına bağlanılamadı.';
}
$pages = max(1, (int) ceil($res['total'] / $per));
?><!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kayıtlar</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>
<body class="bg-light"><div class="container py-3">
<div class="d-flex justify-content-between mb-3"><h5>Kayıtlı Araçlar (<?= $res['total'] ?>)</h5>
  <div><a class="btn btn-primary btn-sm" href="index.php">+ Yeni Araç</a> <a class="btn btn-outline-secondary btn-sm" href="logout.php">Çıkış</a></div></div>
<form class="mb-3"><input class="form-control" name="q" value="<?= Text::h($q) ?>" placeholder="Şasi no / model / motor no ara"></form>
<?php if ($err): ?><div class="alert alert-danger"><?= Text::h($err) ?></div><?php endif; ?>
<div class="table-responsive"><table class="table table-sm table-striped bg-white align-middle">
<thead><tr><th>Şasi No</th><th>Araç</th><th>Yıl</th><th>KM</th><th>Hasar</th><th>Ambar</th><th>Tarih</th><th></th></tr></thead><tbody>
<?php foreach ($res['rows'] as $r): ?>
<tr><td class="font-monospace"><?= Text::h($r['vin']) ?></td>
<td><?= Text::h(trim($r['make'] . ' ' . $r['commercial_name'])) ?></td><td><?= Text::h((string) $r['model_year']) ?></td>
<td><?= Text::thousands($r['odometer_km']) ?></td><td>%<?= (int) $r['damage_percent'] ?></td>
<td><?= Text::h($r['warehouse']) ?></td><td><?= Text::h($r['inspected_at']) ?></td>
<td class="text-nowrap"><a class="btn btn-outline-primary btn-sm" href="index.php?id=<?= (int) $r['inspection_id'] ?>">Düzenle</a>
<a class="btn btn-danger btn-sm" href="pdf.php?id=<?= (int) $r['inspection_id'] ?>">PDF</a></td></tr>
<?php endforeach; ?></tbody></table></div>
<nav><ul class="pagination pagination-sm">
<?php for ($i = max(1, $page - 3); $i <= min($pages, $page + 3); $i++): ?>
<li class="page-item <?= $i === $page ? 'active' : '' ?>"><a class="page-link" href="?q=<?= urlencode($q) ?>&p=<?= $i ?>"><?= $i ?></a></li>
<?php endfor; ?></ul></nav></div></body></html>
