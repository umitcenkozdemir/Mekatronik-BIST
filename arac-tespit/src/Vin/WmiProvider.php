<?php
declare(strict_types=1);

namespace App\Vin;

/**
 * Çevrimdışı yedek: şasi numarasının ilk 3 hanesinden (WMI) marka tahmini.
 * NHTSA'nın boş döndüğü Avrupa/Türkiye üretim araçlarda en azından markayı doldurur.
 */
final class WmiProvider implements VinProvider
{
    private const WMI = [
        'VF1' => 'RENAULT', 'UU1' => 'DACIA', 'VF3' => 'PEUGEOT', 'VF7' => 'CITROËN',
        'WVW' => 'VOLKSWAGEN', 'WV1' => 'VOLKSWAGEN', 'WV2' => 'VOLKSWAGEN', 'VWV' => 'VOLKSWAGEN',
        'WAU' => 'AUDI', 'WBA' => 'BMW', 'WDB' => 'MERCEDES-BENZ', 'WDD' => 'MERCEDES-BENZ',
        'W0L' => 'OPEL', 'WF0' => 'FORD', 'NM0' => 'FORD', 'ZFA' => 'FIAT', 'ZAR' => 'ALFA ROMEO',
        'TMB' => 'ŠKODA', 'VSS' => 'SEAT', 'NMT' => 'TOYOTA', 'NLH' => 'HYUNDAI', 'KMH' => 'HYUNDAI',
        'NLA' => 'HONDA', 'JHM' => 'HONDA', 'JN1' => 'NISSAN', 'YV1' => 'VOLVO', 'WP0' => 'PORSCHE',
        'SAL' => 'LAND ROVER', '1FA' => 'FORD', '1G1' => 'CHEVROLET',
    ];

    public function name(): string
    {
        return 'wmi';
    }

    public function decode(string $vin): array
    {
        $make = self::WMI[substr($vin, 0, 3)] ?? null;
        return $make ? ['make' => $make] : [];
    }
}
