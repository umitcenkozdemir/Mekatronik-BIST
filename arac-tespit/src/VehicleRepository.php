<?php
declare(strict_types=1);

namespace App;

use PDO;

final class VehicleRepository
{
    private const VEHICLE_COLS = ['make', 'commercial_name', 'type_code', 'model_year', 'vehicle_class',
        'body_type', 'door_count', 'color', 'engine_no'];
    private const SPEC_COLS = ['curb_weight_kg', 'max_laden_kg', 'gross_train_kg', 'trailer_braked_kg',
        'trailer_unbraked_kg', 'seat_count', 'steering_side', 'cylinder_count', 'displacement_cc', 'power_kw',
        'fuel_type', 'transmission', 'drive_direction', 'drive_config', 'emission_level', 'length_mm',
        'width_mm', 'height_mm', 'wheelbase_mm', 'tire_size'];
    private const INSPECTION_COLS = ['inspected_at', 'odometer_km', 'damage_percent', 'has_key', 'has_type_label',
        'has_radio', 'has_towbar', 'has_sunroof', 'has_catalytic', 'battery_status', 'tire_condition'];

    public function __construct(private ?PDO $pdo = null)
    {
        $this->pdo ??= Database::pdo();
    }

    /** @return array{vehicle_id:int, inspection_id:?int}|null */
    public function findByVin(string $vin): ?array
    {
        $st = $this->pdo->prepare(
            'SELECT v.id AS vehicle_id, (SELECT MAX(i.id) FROM inspections i WHERE i.vehicle_id = v.id) AS inspection_id
               FROM vehicles v WHERE v.vin = ?'
        );
        $st->execute([$vin]);
        $r = $st->fetch();
        return $r ? ['vehicle_id' => (int) $r['vehicle_id'], 'inspection_id' => $r['inspection_id'] !== null ? (int) $r['inspection_id'] : null] : null;
    }

    /**
     * Aynı model (VIN'in ilk 8 hanesi: WMI+VDS) için daha önce girilmiş teknik verileri döner.
     * Yediemin otoparklarında aynı modelden çok araç olduğundan, API'nin vermediği ağırlık/boyut
     * değerleri bir kez girildikten sonra tekrar otomatik dolar.
     * @return array<string,mixed>
     */
    public function findTemplate(string $vin): array
    {
        $cols = array_merge(
            array_diff(self::VEHICLE_COLS, ['color', 'engine_no']),
            array_map(static fn($c) => "s.$c", self::SPEC_COLS)
        );
        $cols = array_map(static fn($c) => str_contains($c, '.') ? $c : "v.$c", $cols);
        $st = $this->pdo->prepare(
            'SELECT ' . implode(',', $cols) . ' FROM vehicles v JOIN vehicle_specs s ON s.vehicle_id = v.id
              WHERE v.vin LIKE ? AND v.vin <> ? ORDER BY v.updated_at DESC LIMIT 1'
        );
        $st->execute([substr($vin, 0, 8) . '%', $vin]);
        $r = $st->fetch() ?: [];
        return array_filter($r, static fn($v) => $v !== null && $v !== '');
    }

    /** @return int inspection id */
    public function save(array $d, ?array $rawDecode = null): int
    {
        $this->pdo->beginTransaction();
        try {
            $vid = $this->upsertVehicle($d);
            $this->upsertSpecs($vid, $d, $rawDecode);
            $iid = $this->saveInspection($vid, $d);
            $this->saveFindings($iid, $d['findings']);
            $this->pdo->commit();
            return $iid;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /** Form ve PDF için düz (flat) kayıt. */
    public function load(int $inspectionId): ?array
    {
        $st = $this->pdo->prepare(
            'SELECT v.vin, ' . implode(',', array_map(fn($c) => "v.$c", self::VEHICLE_COLS)) . ',
                    ' . implode(',', array_map(fn($c) => "s.$c", self::SPEC_COLS)) . ',
                    s.decode_sources, i.id AS inspection_id, i.vehicle_id, i.inspector_id,
                    ' . implode(',', array_map(fn($c) => "i.$c", self::INSPECTION_COLS)) . ',
                    w.name AS warehouse, n.full_name AS inspector_name, n.title AS inspector_title,
                    n.registry_info AS inspector_registry
               FROM inspections i
               JOIN vehicles v ON v.id = i.vehicle_id
          LEFT JOIN vehicle_specs s ON s.vehicle_id = v.id
          LEFT JOIN warehouses w ON w.id = i.warehouse_id
          LEFT JOIN inspectors n ON n.id = i.inspector_id
              WHERE i.id = ?'
        );
        $st->execute([$inspectionId]);
        $r = $st->fetch();
        if (!$r) {
            return null;
        }
        $f = $this->pdo->prepare('SELECT text FROM inspection_findings WHERE inspection_id = ? ORDER BY sort_order, id');
        $f->execute([$inspectionId]);
        $r['findings'] = $f->fetchAll(PDO::FETCH_COLUMN);
        return $r;
    }

    /** @return array{rows: array<int,array>, total: int} */
    public function search(string $q, int $limit = 25, int $offset = 0): array
    {
        $where = '';
        $params = [];
        if ($q !== '') {
            $where = 'WHERE v.vin LIKE ? OR v.commercial_name LIKE ? OR v.engine_no LIKE ?';
            $like = '%' . addcslashes($q, '%_\\') . '%';
            $params = [$like, $like, $like];
        }
        $total = $this->pdo->prepare("SELECT COUNT(*) FROM vehicles v $where");
        $total->execute($params);

        $st = $this->pdo->prepare(
            "SELECT v.vin, v.make, v.commercial_name, v.model_year, i.id AS inspection_id, i.inspected_at,
                    i.odometer_km, i.damage_percent, w.name AS warehouse
               FROM vehicles v
               JOIN inspections i ON i.id = (SELECT MAX(id) FROM inspections WHERE vehicle_id = v.id)
          LEFT JOIN warehouses w ON w.id = i.warehouse_id
               $where ORDER BY i.updated_at DESC LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset
        );
        $st->execute($params);
        return ['rows' => $st->fetchAll(), 'total' => (int) $total->fetchColumn()];
    }

    /** @return array<int,array> */
    public function inspectors(): array
    {
        return $this->pdo->query('SELECT id, full_name, title FROM inspectors WHERE is_active = 1 ORDER BY full_name')->fetchAll();
    }

    private function upsertVehicle(array $d): int
    {
        $existing = $this->findByVin($d['vin']);
        $vals = array_map(fn($c) => $d[$c], self::VEHICLE_COLS);
        if ($existing) {
            $set = implode(',', array_map(fn($c) => "$c = ?", self::VEHICLE_COLS));
            $this->pdo->prepare("UPDATE vehicles SET $set WHERE id = ?")->execute([...$vals, $existing['vehicle_id']]);
            return $existing['vehicle_id'];
        }
        $cols = implode(',', self::VEHICLE_COLS);
        $ph = implode(',', array_fill(0, count(self::VEHICLE_COLS), '?'));
        $this->pdo->prepare("INSERT INTO vehicles (vin, $cols) VALUES (?, $ph)")->execute([$d['vin'], ...$vals]);
        return (int) $this->pdo->lastInsertId();
    }

    private function upsertSpecs(int $vid, array $d, ?array $raw): void
    {
        $cols = array_merge(self::SPEC_COLS, ['decode_sources', 'decode_raw']);
        $vals = array_map(fn($c) => $d[$c] ?? null, self::SPEC_COLS);
        $vals[] = $d['decode_sources'] ?? null;
        $vals[] = $raw ? json_encode($raw, JSON_UNESCAPED_UNICODE) : null;

        $ph = implode(',', array_fill(0, count($cols), '?'));
        $upd = implode(',', array_map(fn($c) => $c === 'decode_raw' ? 'decode_raw = COALESCE(VALUES(decode_raw), decode_raw)' : "$c = VALUES($c)", $cols));
        $this->pdo->prepare(
            'INSERT INTO vehicle_specs (vehicle_id,' . implode(',', $cols) . ") VALUES (?, $ph) ON DUPLICATE KEY UPDATE $upd"
        )->execute([$vid, ...$vals]);
    }

    private function saveInspection(int $vid, array $d): int
    {
        $wid = null;
        if ($d['warehouse']) {
            $this->pdo->prepare('INSERT INTO warehouses (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)')
                ->execute([$d['warehouse']]);
            $wid = (int) $this->pdo->lastInsertId();
        }
        $vals = array_map(fn($c) => $d[$c], self::INSPECTION_COLS);

        $iid = $d['inspection_id'];
        if ($iid !== null) { // sadece bu araca ait kaydı güncelle
            $chk = $this->pdo->prepare('SELECT id FROM inspections WHERE id = ? AND vehicle_id = ?');
            $chk->execute([$iid, $vid]);
            $iid = $chk->fetchColumn() ?: null;
        }
        if ($iid !== null) {
            $set = implode(',', array_map(fn($c) => "$c = ?", self::INSPECTION_COLS));
            $this->pdo->prepare("UPDATE inspections SET warehouse_id = ?, inspector_id = ?, $set WHERE id = ?")
                ->execute([$wid, $d['inspector_id'], ...$vals, $iid]);
            return (int) $iid;
        }
        $cols = implode(',', self::INSPECTION_COLS);
        $ph = implode(',', array_fill(0, count(self::INSPECTION_COLS), '?'));
        $this->pdo->prepare("INSERT INTO inspections (vehicle_id, warehouse_id, inspector_id, $cols) VALUES (?, ?, ?, $ph)")
            ->execute([$vid, $wid, $d['inspector_id'], ...$vals]);
        return (int) $this->pdo->lastInsertId();
    }

    /** @param string[] $lines */
    private function saveFindings(int $iid, array $lines): void
    {
        $this->pdo->prepare('DELETE FROM inspection_findings WHERE inspection_id = ?')->execute([$iid]);
        $st = $this->pdo->prepare('INSERT INTO inspection_findings (inspection_id, sort_order, text) VALUES (?, ?, ?)');
        foreach ($lines as $i => $line) {
            $st->execute([$iid, $i, $line]);
        }
    }
}
