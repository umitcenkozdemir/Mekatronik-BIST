<?php
declare(strict_types=1);

namespace App;

use Mpdf\Mpdf;

/** T.C. Ticaret Bakanlığı "Araç Tespit ve Değerlendirme Formu" — 2 sayfa (34 madde + durum değerlendirmesi). */
final class PdfReport
{
    private const BATTERY_TEXT = [
        'calisiyor'        => 'Akü sağlıklıdır, araç çalışmaktadır.',
        'bitik_calisti'    => 'Akü bitiktir. Takviye yapılmıştır ve araç çalışmıştır.',
        'bitik_calismadi'  => 'Akü bitiktir. Takviye yapılmıştır ancak araç çalışmamıştır.',
        'bitik_takviyesiz' => 'Akü bitiktir. Takviye yapılmamıştır.',
        'yok'              => 'Araçta akü bulunmamaktadır.',
    ];

    public function __construct(private string $tempDir, private ?string $signatureDir = null)
    {
    }

    /** @param array<string,mixed> $v VehicleRepository::load() çıktısı */
    public function render(array $v): string
    {
        $mpdf = new Mpdf([
            'mode' => 'utf-8', 'format' => 'A4',
            'margin_left' => 18, 'margin_right' => 18, 'margin_top' => 14, 'margin_bottom' => 14,
            'default_font' => 'dejavuserif', 'default_font_size' => 10,
            'tempDir' => $this->tempDir,
        ]);
        $mpdf->SetTitle('Araç Tespit ve Değerlendirme Formu - ' . $v['vin']);
        $mpdf->SetCreator('Araç Tespit Sistemi');
        $mpdf->WriteHTML($this->css(), \Mpdf\HTMLParserMode::HEADER_CSS);
        $mpdf->WriteHTML($this->page1($v) . '<pagebreak />' . $this->page2($v), \Mpdf\HTMLParserMode::HTML_BODY);
        return $mpdf->Output('', \Mpdf\Output\Destination::STRING_RETURN);
    }

    private function css(): string
    {
        return '
          body { font-family: dejavuserif; color:#000; }
          .hdr { text-align:right; font-size:10pt; line-height:1.9; }
          h1 { text-align:center; font-size:13pt; margin:14pt 0 8pt; }
          h2 { text-align:center; font-size:12pt; margin:0 0 10pt; }
          table.f { width:100%; border-collapse:collapse; font-size:8.6pt; }
          table.f td { border:0.6pt solid #000; padding:3.1pt 5pt; }
          td.n { width:6%; text-align:center; font-weight:bold; }
          td.l { width:44%; font-weight:bold; }
          td.v { text-align:center; font-weight:bold; }
          .t { text-align:center; font-size:12pt; font-weight:bold; margin-top:40pt; margin-bottom:22pt; }
          .p { font-size:11pt; line-height:1.5; text-align:justify; margin-bottom:12pt; }
          ul.b { font-size:11pt; line-height:1.5; font-weight:bold; margin-left:12pt; }
          ul.b li { margin-bottom:14pt; text-align:justify; }
          .note { font-size:10.5pt; font-weight:bold; text-align:justify; margin-top:8pt; line-height:1.5; }
          .sig { margin-top:26pt; margin-left:300pt; font-size:9pt; text-align:center; line-height:1.35; }
        ';
    }

    private function head(array $v): string
    {
        $date = (new \DateTime($v['inspected_at']))->format('d.m.Y');
        $amb = $v['warehouse'] ? 'Ambar No: ' . Text::upper($v['warehouse']) : '';
        return '<div class="hdr">' . $date . '<br>' . Text::h($amb) . '</div>';
    }

    private function page1(array $v): string
    {
        $kg = fn($x) => $x === null ? '-' : $x . ' kg';
        $mm = fn($x) => $x === null ? '-' : $x . ' mm';
        $yn = fn($x) => $x ? 'VAR' : 'YOK';
        $rows = [
            'Marka Cinsi' => $v['make'],
            'Ticari Adı' => $v['commercial_name'],
            'Tipi' => $v['type_code'],
            'Model Yılı' => $v['model_year'],
            'Araç Sınıfı' => $v['vehicle_class'],
            'Araç Cinsi' => $v['body_type'],
            'Kapı Adedi' => $v['door_count'],
            'Rengi' => $v['color'],
            'Motor Numarası' => $v['engine_no'],
            'Şasi Numarası' => $v['vin'],
            'Net Ağırlık (Yürür Vaziyette Kütle)' => $kg($v['curb_weight_kg']),
            'Azami Yüklü Ağırlığı' => $kg($v['max_laden_kg']),
            'Katar Ağırlığı' => $kg($v['gross_train_kg']),
            'Römork Azami Ağırlığı (Frenli – Frensiz)' => ($v['trailer_braked_kg'] === null && $v['trailer_unbraked_kg'] === null)
                ? '-' : $kg($v['trailer_braked_kg']) . ' – ' . $kg($v['trailer_unbraked_kg']),
            'Koltuk Sayısı (Sürücü Dâhil)' => $v['seat_count'],
            'Direksiyon Konumu' => $v['steering_side'],
            'Silindir Adedi' => $v['cylinder_count'],
            'Silindir Hacmi' => $v['displacement_cc'] === null ? null : $v['displacement_cc'] . 'cc',
            'Motor Gücü' => $v['power_kw'] === null ? null : rtrim(rtrim(number_format((float) $v['power_kw'], 1, ',', ''), '0'), ',') . 'kW',
            'Yakıt Cinsi' => $v['fuel_type'],
            'Vites Türü' => $v['transmission'],
            'Radyo/Teyp' => $yn($v['has_radio']),
            'Çeki Demiri' => $yn($v['has_towbar']),
            'Sunroof' => $yn($v['has_sunroof']),
            'KM (Göstergede Okunan Değerdir)' => Text::thousands($v['odometer_km']) . ' km',
            'Hasar Oranı' => $v['damage_percent'] === null ? null : '%' . $v['damage_percent'],
            'Emisyon Seviyesi' => $v['emission_level'],
            'Katalitik Konvertör' => $yn($v['has_catalytic']),
            'Çekiş Yönü' => $v['drive_direction'],
            'Çekiş Durumu' => $v['drive_config'],
            'Kasa Uzunluğu' => $mm($v['length_mm']),
            'Kasa Genişliği' => $mm($v['width_mm']),
            'Kasa Yüksekliği' => $mm($v['height_mm']),
            'Dingil Mesafesi' => $mm($v['wheelbase_mm']),
        ];
        $html = $this->head($v)
            . '<h1>ARAÇ TESPİT ve DEĞERLENDİRME FORMU</h1>'
            . '<h2>T.C. TİCARET BAKANLIĞI BAKIRKÖY TASFİYE İŞLETME<br>MÜDÜRLÜĞÜNE</h2><table class="f">';
        $i = 1;
        foreach ($rows as $label => $val) {
            $val = ($val === null || $val === '') ? '-' : (string) $val;
            $html .= '<tr><td class="n">' . $i++ . '</td><td class="l">' . Text::h($label)
                . '</td><td class="v">' . Text::h($val) . '</td></tr>';
        }
        return $html . '</table>';
    }

    private function page2(array $v): string
    {
        $bullets = [];
        $bullets[] = $v['has_key'] ? 'Aracın anahtarı mevcuttur.' : 'Aracın anahtarı yoktur.';
        $bullets[] = $v['has_type_label'] ? 'Tip onay etiketi mevcuttur.' : 'Tip onay etiketi yoktur.';
        $bullets[] = self::BATTERY_TEXT[$v['battery_status']] ?? self::BATTERY_TEXT['calisiyor'];
        $bullets[] = null; // hasar notları buraya (tek madde, birleşik paragraf)
        $tire = $v['tire_size'] ? 'Lastik ebatları ' . $v['tire_size'] . ' şeklindedir.' : '';
        $bullets[] = match ($v['tire_condition']) {
            'omrunu_doldurmus' => trim('Aracın lastikleri kullanım ömrünü doldurmuştur. Bir takım lastik ihtiyacı vardır. ' . $tire),
            'orta' => trim('Aracın lastikleri orta durumdadır. ' . $tire),
            default => trim('Aracın lastikleri kullanılabilir durumdadır. ' . $tire),
        };
        $bullets[] = 'Aracın Hasar Oranı: %' . ($v['damage_percent'] ?? 0);

        $findings = implode(' ', array_map(
            static fn($l) => preg_match('/[.!?]$/u', $l) ? $l : $l . '.',
            $v['findings'] ?? []
        ));
        $bullets[3] = $findings;

        $li = '';
        foreach ($bullets as $b) {
            if ($b !== null && $b !== '') {
                $li .= '<li>' . Text::h($b) . '</li>';
            }
        }

        $model = trim(($v['make'] ?? '') . ' ' . ($v['commercial_name'] ?? ''));
        return $this->head($v)
            . '<div class="t">ARAÇ DURUM DEĞERLENDİRMESİ</div>'
            . '<p class="p">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>' . Text::h($v['vin']) . '</b> şasi numaralı <b>' . Text::h($model)
            . '</b> marka ' . ($v['model_year'] ? '<b>' . (int) $v['model_year'] . '</b> model ' : '')
            . 'araç üzerinde yapılan çalışmalar sonucu aşağıdaki hususlar tespit edilmiştir:</p>'
            . '<ul class="b">' . $li . '</ul>'
            . '<p class="note">*Kontroller görsel olarak yapılmıştır. Aracın tespit edilen, muadilinin veya imalatçı beyanlarındaki '
            . 'özelliklerinin varlığı ve çalışır olup olmadığının tespit edilemediği göz önünde bulundurulmalıdır.</p>'
            . $this->signature($v);
    }

    private function signature(array $v): string
    {
        if (empty($v['inspector_name'])) {
            return '';
        }
        $img = '';
        if ($this->signatureDir && !empty($v['inspector_id'])) {
            $path = rtrim($this->signatureDir, '/') . '/' . (int) $v['inspector_id'] . '.png';
            if (is_file($path)) {
                $img = '<img src="' . $path . '" style="height:70pt"><br>';
            }
        }
        return '<div class="sig">' . $img . '<b>' . Text::h($v['inspector_name']) . '</b><br>'
            . Text::h($v['inspector_title'] ?? '') . '<br>' . Text::h($v['inspector_registry'] ?? '') . '</div>';
    }
}
