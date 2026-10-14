<?php
declare(strict_types=1);

namespace App\Vin;

/** NHTSA vPIC — https://vpic.nhtsa.dot.gov/api/ (ABD odaklı; AB araçlarında kısmi veri döner). */
final class NhtsaProvider implements VinProvider
{
    private const ENDPOINT = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';

    private const BODY_MAP = [
        'sedan' => 'SEDAN', 'saloon' => 'SEDAN', 'hatchback' => 'HATCHBACK',
        'station wagon' => 'STATION WAGON', 'wagon' => 'STATION WAGON',
        'sport utility' => 'SUV', 'suv' => 'SUV', 'crossover' => 'SUV',
        'coupe' => 'COUPE', 'convertible' => 'CABRIO', 'pickup' => 'PICK-UP',
        'van' => 'PANELVAN', 'minivan' => 'MINIVAN', 'truck' => 'KAMYON', 'bus' => 'OTOBÜS',
    ];

    private const FUEL_MAP = [
        'diesel' => 'DİZEL', 'gasoline' => 'BENZİN', 'electric' => 'ELEKTRİK',
        'liquefied petroleum' => 'LPG', 'compressed natural' => 'CNG', 'flexible' => 'BENZİN/ETANOL',
    ];

    public function __construct(private HttpClient $http = new HttpClient())
    {
    }

    public function name(): string
    {
        return 'nhtsa';
    }

    public function decode(string $vin): array
    {
        $json = $this->http->getJson(self::ENDPOINT . rawurlencode($vin) . '?format=json');
        $r = $json['Results'][0] ?? null;
        if (!is_array($r) || trim((string) ($r['Make'] ?? '')) === '') {
            return []; // çözülemedi — hata değil, sadece veri yok
        }

        $f = [
            'make'            => $this->upper($r['Make'] ?? ''),
            'commercial_name' => $this->upper(trim(($r['Model'] ?? '') . ' ' . ($r['Trim'] ?? ''))),
            'model_year'      => $this->int($r['ModelYear'] ?? null),
            'body_type'       => $this->map((string) ($r['BodyClass'] ?? ''), self::BODY_MAP),
            'door_count'      => $this->int($r['Doors'] ?? null),
            'cylinder_count'  => $this->int($r['EngineNumberofCylinders'] ?? null),
            'displacement_cc' => $this->displacement($r),
            'power_kw'        => $this->float($r['EngineKW'] ?? null),
            'fuel_type'       => $this->map((string) ($r['FuelTypePrimary'] ?? ''), self::FUEL_MAP),
            'transmission'    => $this->transmission((string) ($r['TransmissionStyle'] ?? '')),
            'drive_direction' => $this->drive((string) ($r['DriveType'] ?? '')),
            'steering_side'   => $this->steering((string) ($r['SteeringLocation'] ?? '')),
            'seat_count'      => $this->int($r['Seats'] ?? null),
            'wheelbase_mm'    => $this->wheelbase($r),
            'engine_model'    => trim((string) ($r['EngineModel'] ?? '')),
        ];
        if ($f['drive_direction'] !== null) {
            $f['drive_config'] = '4x' . ($f['drive_direction'] === 'AWD' || $f['drive_direction'] === '4WD' ? '4' : '2');
        }
        $f['_raw'] = array_filter($r, static fn($v) => $v !== null && $v !== '' && $v !== 'Not Applicable');
        return array_filter($f, static fn($v) => $v !== null && $v !== '' && $v !== 0);
    }

    private function upper(string $s): string
    {
        return mb_strtoupper(trim($s), 'UTF-8');
    }

    private function int(mixed $v): ?int
    {
        return is_numeric($v) && (int) $v > 0 ? (int) $v : null;
    }

    private function float(mixed $v): ?float
    {
        return is_numeric($v) && (float) $v > 0 ? (float) $v : null;
    }

    private function displacement(array $r): ?int
    {
        if (is_numeric($r['DisplacementCC'] ?? null) && (float) $r['DisplacementCC'] > 0) {
            return (int) round((float) $r['DisplacementCC']);
        }
        if (is_numeric($r['DisplacementL'] ?? null) && (float) $r['DisplacementL'] > 0) {
            return (int) round((float) $r['DisplacementL'] * 1000);
        }
        return null;
    }

    private function wheelbase(array $r): ?int
    {
        foreach (['WheelBaseShort', 'WheelBaseLong'] as $k) {
            if (is_numeric($r[$k] ?? null) && (float) $r[$k] > 0) {
                return (int) round((float) $r[$k] * 25.4); // inç → mm
            }
        }
        return null;
    }

    /** @param array<string,string> $map */
    private function map(string $value, array $map): ?string
    {
        $v = mb_strtolower($value, 'UTF-8');
        foreach ($map as $needle => $out) {
            if ($v !== '' && str_contains($v, $needle)) {
                return $out;
            }
        }
        return null;
    }

    private function transmission(string $s): ?string
    {
        $s = strtolower($s);
        return match (true) {
            $s === '' => null,
            str_contains($s, 'manual'), str_contains($s, 'standard') => 'MANUEL',
            str_contains($s, 'automatic'), str_contains($s, 'cvt'), str_contains($s, 'dual') => 'OTOMATİK',
            default => null,
        };
    }

    private function drive(string $s): ?string
    {
        $s = strtolower($s);
        return match (true) {
            str_contains($s, 'fwd'), str_contains($s, 'front') => 'FWD',
            str_contains($s, 'rwd'), str_contains($s, 'rear')  => 'RWD',
            str_contains($s, 'awd'), str_contains($s, 'all')   => 'AWD',
            str_contains($s, '4wd'), str_contains($s, '4x4')   => '4WD',
            default => null,
        };
    }

    private function steering(string $s): ?string
    {
        $s = strtolower($s);
        return match (true) {
            str_contains($s, 'left')  => 'SOL',
            str_contains($s, 'right') => 'SAĞ',
            default => null,
        };
    }
}
