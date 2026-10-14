<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use App\Config;

Config::load(__DIR__ . '/.env');

$debug = Config::get('APP_DEBUG', '0') === '1';
ini_set('display_errors', $debug ? '1' : '0');
error_reporting(E_ALL);

session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
session_start();

/** Giriş ve CSRF yardımcıları */
function require_login(bool $json = false): void
{
    if (empty($_SESSION['user'])) {
        if ($json) {
            json_out(['ok' => false, 'error' => 'Oturum süresi doldu, tekrar giriş yapın.'], 401);
        }
        header('Location: login.php');
        exit;
    }
}

function csrf_token(): string
{
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
}

function require_csrf(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf'] ?? '');
    if (!hash_equals(csrf_token(), (string) $sent)) {
        json_out(['ok' => false, 'error' => 'Geçersiz istek (CSRF).'], 403);
    }
}

function json_out(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
