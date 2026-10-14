<?php
declare(strict_types=1);

namespace App;

use App\Vin\NhtsaProvider;
use App\Vin\VinDecodeException;
use App\Vin\VinProvider;
use App\Vin\WmiProvider;

/**
 * Sağlayıcıları sırayla dener; ilk dolu değer kazanır.
 * Hiçbir koşulda exception fırlatmaz: sonuç boş bile olsa form elle doldurulabilir.
 */
final class VinDecoder
{
    /** @var VinProvider[] */
    private array $providers;

    /** @param VinProvider[]|null $providers */
    public function __construct(?array $providers = null)
    {
        $this->providers = $providers ?? [new NhtsaProvider(), new WmiProvider()];
    }

    /** ISO 3779: 17 hane, I/O/Q yok. (AB araçlarında check digit zorunlu olmadığından doğrulanmaz.) */
    public static function normalize(string $vin): string
    {
        return strtoupper(preg_replace('/\s+/', '', $vin) ?? '');
    }

    public static function isValid(string $vin): bool
    {
        return (bool) preg_match('/^[A-HJ-NPR-Z0-9]{17}$/', $vin);
    }

    /**
     * @return array{fields: array<string,mixed>, raw: ?array, sources: string[], warnings: string[]}
     */
    public function decode(string $vin): array
    {
        $fields = [];
        $raw = null;
        $sources = [];
        $warnings = [];

        foreach ($this->providers as $p) {
            try {
                $data = $p->decode($vin);
            } catch (VinDecodeException $e) {
                $warnings[] = strtoupper($p->name()) . ': ' . $e->getMessage();
                continue;
            } catch (\Throwable $e) {
                $warnings[] = strtoupper($p->name()) . ': beklenmeyen hata';
                error_log('[VinDecoder] ' . $p->name() . ': ' . $e->getMessage());
                continue;
            }
            if (isset($data['_raw'])) {
                $raw = $data['_raw'];
                unset($data['_raw']);
            }
            if ($data === []) {
                continue;
            }
            $before = count($fields);
            $fields += $data; // mevcut anahtarları ezmez
            if (count($fields) > $before) {
                $sources[] = $p->name();
            }
        }

        if ($fields === []) {
            $warnings[] = 'VIN çözülemedi. Alanları elle doldurabilirsiniz.';
        } elseif (!isset($fields['commercial_name'])) {
            $warnings[] = 'Model/teknik veriler API\'den gelmedi (Avrupa üretim araçlarda sık görülür); eksikleri elle girin.';
        }
        return ['fields' => $fields, 'raw' => $raw, 'sources' => $sources, 'warnings' => $warnings];
    }
}
