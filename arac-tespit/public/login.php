<?php
declare(strict_types=1);
require __DIR__ . '/../bootstrap.php';

use App\Config;
use App\Text;

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $hash = Config::get('APP_PASS_HASH', '');
    $okUser = hash_equals((string) Config::get('APP_USER', 'eksper'), (string) ($_POST['user'] ?? ''));
    if ($okUser && $hash && password_verify((string) ($_POST['pass'] ?? ''), $hash)) {
        session_regenerate_id(true);
        $_SESSION['user'] = $_POST['user'];
        header('Location: index.php');
        exit;
    }
    usleep(500000);
    $error = 'Kullanıcı adı veya şifre hatalı.';
}
?><!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Giriş</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>
<body class="bg-light"><div class="container" style="max-width:380px;margin-top:15vh">
<form method="post" class="card card-body shadow-sm">
  <h5 class="mb-3">Araç Tespit Sistemi</h5>
  <?php if ($error): ?><div class="alert alert-danger py-2"><?= Text::h($error) ?></div><?php endif; ?>
  <input class="form-control mb-2" name="user" placeholder="Kullanıcı" autocomplete="username" required>
  <input class="form-control mb-3" type="password" name="pass" placeholder="Şifre" autocomplete="current-password" required>
  <button class="btn btn-primary">Giriş</button>
</form></div></body></html>
