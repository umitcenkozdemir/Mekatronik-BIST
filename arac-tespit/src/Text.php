<?php
declare(strict_types=1);

namespace App;

final class Text
{
    /** Türkçe büyük harf: i→İ, ı→I. */
    public static function upper(string $s): string
    {
        return mb_strtoupper(strtr(trim($s), ['i' => 'İ', 'ı' => 'I']), 'UTF-8');
    }

    public static function h(?string $s): string
    {
        return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public static function thousands(int|float|null $n): string
    {
        return $n === null ? '-' : number_format((float) $n, 0, ',', '.');
    }
}
