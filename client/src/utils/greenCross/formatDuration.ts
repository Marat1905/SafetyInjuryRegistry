/**
 * Утилиты форматирования длительности периода в днях с правильной
 * формой русских слов.
 */

/**
 * Форматирует количество дней в строку с правильной формой слова «день».
 *
 * Примеры:
 *   formatDuration(1)   → "1 день"
 *   formatDuration(2)   → "2 дня"
 *   formatDuration(4)   → "4 дня"
 *   formatDuration(5)   → "5 дней"
 *   formatDuration(11)  → "11 дней"
 *   formatDuration(21)  → "21 день"
 *   formatDuration(365) → "365 дней"
 */
export const formatDuration = (days: number): string => {
    const n = Math.abs(Math.floor(days));
    const mod10 = n % 10;
    const mod100 = n % 100;
    let unit: string;
    if (mod10 === 1 && mod100 !== 11) {
        unit = 'день';
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        unit = 'дня';
    } else {
        unit = 'дней';
    }
    return `${days} ${unit}`;
};

/**
 * Сокращённая форма: «4 дн.» — для компактных бейджей, где склонение не нужно.
 */
export const formatDurationShort = (days: number): string => `${days} дн.`;