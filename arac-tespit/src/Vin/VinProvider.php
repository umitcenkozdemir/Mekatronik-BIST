<?php
declare(strict_types=1);

namespace App\Vin;

interface VinProvider
{
    public function name(): string;

    /**
     * @return array<string,mixed> Normalize edilmiş alanlar (boş olabilir).
     * @throws VinDecodeException Ağ/API hatasında.
     */
    public function decode(string $vin): array;
}
