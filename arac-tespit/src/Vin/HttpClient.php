<?php
declare(strict_types=1);

namespace App\Vin;

class HttpClient
{
    public function __construct(private int $timeout = 8, private int $retries = 1)
    {
    }

    /** @return array<string,mixed> */
    public function getJson(string $url): array
    {
        $lastError = 'bilinmeyen hata';
        for ($i = 0; $i <= $this->retries; $i++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => $this->timeout,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 2,
                CURLOPT_HTTPHEADER     => ['Accept: application/json'],
                CURLOPT_USERAGENT      => 'arac-tespit/1.0',
            ]);
            $body = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err  = curl_error($ch);
            curl_close($ch);

            if ($body !== false && $code >= 200 && $code < 300) {
                $json = json_decode((string) $body, true);
                if (is_array($json)) {
                    return $json;
                }
                $lastError = 'geçersiz JSON yanıtı';
            } else {
                $lastError = $err !== '' ? $err : "HTTP $code";
            }
        }
        throw new VinDecodeException("API isteği başarısız: $lastError");
    }
}
