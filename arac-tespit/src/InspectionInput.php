<?php
declare(strict_types=1);

namespace App;

/** Form girdisini normalize eder ve doğrular. Eksik teknik veri hata değildir (elle doldurulabilir). */
final class InspectionInput
{
    public const TEXT_UPPER = ['make', 'commercial_name', 'type_code', 'vehicle_class', 'body_type', 'color',
        'engine_no', 'steering_side', 'fuel_type', 'transmission', 'drive_direction', 'drive_config', 'emission_level'];
    public const INTS = ['model_year', 'door_count', 'curb_weight_kg', 'max_laden_kg', 'gross_train_kg',
        'trailer_braked_kg', 'trailer_unbraked_kg', 'seat_count', 'cylinder_count', 'displacement_cc',
        'length_mm', 'width_mm', 'height_mm', 'wheelbase_mm', 'odometer_km', 'damage_percent'];
    public const BOOLS = ['has_key', 'has_type_label', 'has_radio', 'has_towbar', 'has_sunroof', 'has_catalytic'];
    public const BATTERY = ['calisiyor', 'bitik_calisti', 'bitik_calismadi', 'bitik_takviyesiz', 'yok'];
    public const TIRE = ['iyi', 'orta', 'omrunu_doldurmus'];

    /** @return array{data: array<string,mixed>, errors: string[]} */
    public static function fromRequest(array $in): array
    {
        $errors = [];
        $d = [];

        $d['vin'] = VinDecoder::normalize((string) ($in['vin'] ?? ''));
        if (!VinDecoder::isValid($d['vin'])) {
            $errors[] = 'Şasi numarası 17 haneli olmalı (I, O, Q kullanılamaz).';
        }

        foreach (self::TEXT_UPPER as $k) {
            $v = Text::upper((string) ($in[$k] ?? ''));
            $d[$k] = $v === '' ? null : mb_substr($v, 0, 120);
        }
        foreach (self::INTS as $k) {
            $v = $in[$k] ?? '';
            $v = is_string($v) ? preg_replace('/[^\d]/', '', $v) : $v; // "313.511" → 313511
            $d[$k] = ($v === '' || $v === null) ? null : (int) $v;
        }
        $kw = str_replace(',', '.', trim((string) ($in['power_kw'] ?? '')));
        $d['power_kw'] = is_numeric($kw) ? (float) $kw : null;
        $d['tire_size'] = self::clean($in['tire_size'] ?? null, 30);

        foreach (self::BOOLS as $k) {
            $d[$k] = in_array((string) ($in[$k] ?? '0'), ['1', 'on', 'true', 'VAR'], true) ? 1 : 0;
        }

        $d['battery_status'] = in_array($in['battery_status'] ?? '', self::BATTERY, true) ? $in['battery_status'] : 'calisiyor';
        $d['tire_condition'] = in_array($in['tire_condition'] ?? '', self::TIRE, true) ? $in['tire_condition'] : 'iyi';

        $date = (string) ($in['inspected_at'] ?? '');
        $dt = \DateTime::createFromFormat('Y-m-d', $date);
        if (!$dt || $dt->format('Y-m-d') !== $date) {
            $errors[] = 'Tespit tarihi geçersiz.';
            $date = date('Y-m-d');
        }
        $d['inspected_at'] = $date;

        if ($d['damage_percent'] !== null && $d['damage_percent'] > 100) {
            $errors[] = 'Hasar oranı 0-100 arasında olmalı.';
        }
        if ($d['model_year'] !== null && ($d['model_year'] < 1950 || $d['model_year'] > (int) date('Y') + 1)) {
            $errors[] = 'Model yılı geçersiz.';
        }
        if ($d['odometer_km'] === null) {
            $errors[] = 'Güncel KM zorunludur.';
        }
        if ($d['damage_percent'] === null) {
            $errors[] = 'Hasar oranı zorunludur.';
        }

        $d['warehouse'] = self::clean($in['warehouse'] ?? null, 160);
        $d['inspector_id'] = ctype_digit((string) ($in['inspector_id'] ?? '')) ? (int) $in['inspector_id'] : null;
        $d['inspection_id'] = ctype_digit((string) ($in['inspection_id'] ?? '')) ? (int) $in['inspection_id'] : null;
        $d['decode_sources'] = self::clean($in['decode_sources'] ?? null, 120);

        $lines = preg_split('/\R/u', (string) ($in['findings'] ?? '')) ?: [];
        $d['findings'] = array_values(array_filter(array_map(
            static fn($l) => mb_substr(trim($l), 0, 1000),
            $lines
        ), static fn($l) => $l !== ''));

        return ['data' => $d, 'errors' => $errors];
    }

    private static function clean(mixed $v, int $max): ?string
    {
        $v = trim((string) $v);
        return $v === '' ? null : mb_substr($v, 0, $max);
    }
}
