<?php
declare(strict_types=1);

namespace App;

use App\Vin\VinDecodeException;

/** Şasi/VIN fotoğrafından Claude vision ile 17 haneli numarayı okur. */
class VinScanner
{
    private const ENDPOINT = 'https://api.anthropic.com/v1/messages';
    private const PROMPT = <<<'TXT'
Bu fotoğrafta bir aracın şasi numarası (VIN) var: cam altı plaka, şasi üzerine kazınmış/çakılmış yazı, etiket veya ruhsat olabilir.
17 haneli VIN'i oku. VIN'de I, O, Q harfi bulunmaz (I→1, O→0, Q→0 olarak oku). Emin olmadığın haneyi UYDURMA.
Yalnızca şu JSON'u döndür: {"vin": "<17 karakter veya null>", "confidence": "high|medium|low", "note": "<kısa not>"}
TXT;

    public function __construct(private ?string $apiKey = null, private ?string $model = null)
    {
        $this->apiKey ??= Config::get('ANTHROPIC_API_KEY');
        $this->model ??= Config::get('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
    }

    /** @return array{vin: ?string, confidence: string, note: string} */
    public function scan(string $imageBytes, string $mime): array
    {
        if (!$this->apiKey) {
            throw new VinDecodeException('Fotoğraf okuma yapılandırılmamış (ANTHROPIC_API_KEY).');
        }
        $resp = $this->post([
            'model' => $this->model,
            'max_tokens' => 200,
            'messages' => [[
                'role' => 'user',
                'content' => [
                    ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mime, 'data' => base64_encode($imageBytes)]],
                    ['type' => 'text', 'text' => self::PROMPT],
                ],
            ]],
        ]);
        $text = '';
        foreach ($resp['content'] ?? [] as $block) {
            if (($block['type'] ?? '') === 'text') {
                $text .= $block['text'];
            }
        }
        if (!preg_match('/\{.*\}/s', $text, $m) || !is_array($j = json_decode($m[0], true))) {
            throw new VinDecodeException('Okuma sonucu anlaşılamadı.');
        }
        $vin = isset($j['vin']) ? VinDecoder::normalize((string) $j['vin']) : '';
        return [
            'vin' => $vin !== '' ? $vin : null,
            'confidence' => (string) ($j['confidence'] ?? 'low'),
            'note' => (string) ($j['note'] ?? ''),
        ];
    }

    /** @return array<string,mixed> */
    protected function post(array $payload): array
    {
        $ch = curl_init(self::ENDPOINT);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER => [
                'content-type: application/json',
                'x-api-key: ' . $this->apiKey,
                'anthropic-version: 2023-06-01',
            ],
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        $json = is_string($body) ? json_decode($body, true) : null;
        if ($code !== 200 || !is_array($json)) {
            error_log("[VinScanner] HTTP $code $err " . substr((string) $body, 0, 300));
            throw new VinDecodeException('Fotoğraf okuma servisine ulaşılamadı.');
        }
        return $json;
    }
}
