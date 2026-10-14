-- Araç Tespit ve Değerlendirme Sistemi — MySQL 8 / MariaDB 10.5+
CREATE TABLE IF NOT EXISTS warehouses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(160) NOT NULL UNIQUE,         -- "Ambar No" satırı
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS inspectors (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  title         VARCHAR(120) NOT NULL DEFAULT 'Makine Mühendisi',
  registry_info VARCHAR(255) NULL,                  -- oda sicil no, vergi no, adres (imza altı)
  is_active     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS vehicles (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vin             CHAR(17) NOT NULL UNIQUE,         -- Şasi No (1 araç = 1 kayıt)
  make            VARCHAR(60)  NULL,                -- Marka Cinsi
  commercial_name VARCHAR(120) NULL,                -- Ticari Adı
  type_code       VARCHAR(40)  NULL,                -- Tipi
  model_year      SMALLINT UNSIGNED NULL,
  vehicle_class   VARCHAR(20)  NULL,                -- M1 AA
  body_type       VARCHAR(40)  NULL,                -- SEDAN
  door_count      TINYINT UNSIGNED NULL,
  color           VARCHAR(40)  NULL,
  engine_no       VARCHAR(40)  NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vin_prefix (vin(8))                     -- aynı modelin önceki kaydını bulmak için
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS vehicle_specs (
  vehicle_id         INT UNSIGNED PRIMARY KEY,
  curb_weight_kg     SMALLINT UNSIGNED NULL,        -- Net ağırlık
  max_laden_kg       SMALLINT UNSIGNED NULL,        -- Azami yüklü ağırlık
  gross_train_kg     SMALLINT UNSIGNED NULL,        -- Katar ağırlığı
  trailer_braked_kg  SMALLINT UNSIGNED NULL,
  trailer_unbraked_kg SMALLINT UNSIGNED NULL,
  seat_count         TINYINT UNSIGNED NULL,
  steering_side      VARCHAR(10) NULL,              -- SOL / SAĞ
  cylinder_count     TINYINT UNSIGNED NULL,
  displacement_cc    SMALLINT UNSIGNED NULL,
  power_kw           DECIMAL(6,1) NULL,
  fuel_type          VARCHAR(30) NULL,
  transmission       VARCHAR(20) NULL,
  drive_direction    VARCHAR(10) NULL,              -- FWD/RWD/AWD
  drive_config       VARCHAR(10) NULL,              -- 4x2
  emission_level     VARCHAR(20) NULL,
  length_mm          SMALLINT UNSIGNED NULL,
  width_mm           SMALLINT UNSIGNED NULL,
  height_mm          SMALLINT UNSIGNED NULL,
  wheelbase_mm       SMALLINT UNSIGNED NULL,
  tire_size          VARCHAR(30) NULL,
  decode_sources     VARCHAR(120) NULL,             -- nhtsa,wmi,gecmis-kayit
  decode_raw         JSON NULL,                     -- API ham yanıtı (denetim için)
  CONSTRAINT fk_specs_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS inspections (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_id      INT UNSIGNED NOT NULL,
  warehouse_id    INT UNSIGNED NULL,
  inspector_id    INT UNSIGNED NULL,
  inspected_at    DATE NOT NULL,
  odometer_km     INT UNSIGNED NULL,
  damage_percent  TINYINT UNSIGNED NULL,
  has_key         TINYINT(1) NOT NULL DEFAULT 0,
  has_type_label  TINYINT(1) NOT NULL DEFAULT 0,    -- tip onay etiketi
  has_radio       TINYINT(1) NOT NULL DEFAULT 0,
  has_towbar      TINYINT(1) NOT NULL DEFAULT 0,
  has_sunroof     TINYINT(1) NOT NULL DEFAULT 0,
  has_catalytic   TINYINT(1) NOT NULL DEFAULT 0,
  battery_status  ENUM('calisiyor','bitik_calisti','bitik_calismadi','bitik_takviyesiz','yok') NOT NULL DEFAULT 'calisiyor',
  tire_condition  ENUM('iyi','orta','omrunu_doldurmus') NOT NULL DEFAULT 'iyi',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_insp_vehicle (vehicle_id),
  INDEX idx_insp_date (inspected_at),
  CONSTRAINT fk_insp_vehicle   FOREIGN KEY (vehicle_id)   REFERENCES vehicles(id)   ON DELETE CASCADE,
  CONSTRAINT fk_insp_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
  CONSTRAINT fk_insp_inspector FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS inspection_findings (   -- Çizik/ezik/hasar notları, satır satır
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inspection_id INT UNSIGNED NOT NULL,
  sort_order    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  text          VARCHAR(1000) NOT NULL,
  INDEX idx_find_insp (inspection_id),
  CONSTRAINT fk_find_insp FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

INSERT INTO inspectors (full_name, title, registry_info)
SELECT 'Ad Soyad', 'Makine Mühendisi', 'Oda Sicil No: ... / Sertifika No: ...'
WHERE NOT EXISTS (SELECT 1 FROM inspectors);
