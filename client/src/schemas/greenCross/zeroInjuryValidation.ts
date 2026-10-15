/**
 * Схемы валидации формы «Ноль травм» (react-hook-form + zod).
 */
import { z } from 'zod';

/**
 * Парсит строку 'YYYY-MM-DD' как ЛОКАЛЬНУЮ полночь.
 *
 * КРИТИЧНО: нельзя использовать new Date('2026-10-15') — по стандарту ECMAScript
 * такая строка без времени парсится как UTC-полночь. В зоне UTC+N это даёт
 * сдвиг на N часов вперёд, из-за чего текущий календарный день ошибочно
 * считается «будущим». Собираем дату через компоненты — тогда получаем
 * ровно локальную полночь.
 */
const parseLocalDate = (val: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const date = new Date(y, mo, d);
    // Защита от «2026-02-31» — JS нормализует в 3 марта, поэтому сверяем компоненты.
    if (
        date.getFullYear() !== y ||
        date.getMonth() !== mo ||
        date.getDate() !== d
    ) {
        return null;
    }
    return date;
};

/** Возвращает сегодняшнюю локальную полночь. */
const startOfTodayLocal = (): Date => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
};

/**
 * Схема для создания новой программы.
 * Дата начала — строка YYYY-MM-DD, не в будущем.
 * Описание — не пустое, до 1000 символов.
 * Целевой период — целое число > 0.
 */
export const createZeroInjuryProgramSchema = z.object({
    startDate: z
        .string()
        .min(1, 'Дата начала обязательна')
        .refine((val) => parseLocalDate(val) !== null, {
            message: 'Некорректный формат даты. Используйте YYYY-MM-DD',
        })
        .refine(
            (val) => {
                const picked = parseLocalDate(val);
                if (!picked) return false;
                return picked.getTime() <= startOfTodayLocal().getTime();
            },
            { message: 'Дата начала не может быть в будущем' }
        ),
    description: z
        .string()
        .min(1, 'Описание / основание обязательно')
        .max(1000, 'Описание не должно превышать 1000 символов'),
    targetDays: z
        .number({ message: 'Целевой период обязателен' })
        .int('Целевой период должен быть целым числом')
        .positive('Целевой период должен быть больше нуля')
        .max(3650, 'Целевой период не должен превышать 3650 дней'),
});

/**
 * Схема для обновления существующей программы (все поля опциональны).
 */
export const updateZeroInjuryProgramSchema = z.object({
    startDate: z
        .string()
        .optional()
        .refine((val) => !val || parseLocalDate(val) !== null, {
            message: 'Некорректный формат даты. Используйте YYYY-MM-DD',
        })
        .refine(
            (val) => {
                if (!val) return true;
                const picked = parseLocalDate(val);
                if (!picked) return false;
                return picked.getTime() <= startOfTodayLocal().getTime();
            },
            { message: 'Дата начала не может быть в будущем' }
        ),
    description: z
        .string()
        .max(1000, 'Описание не должно превышать 1000 символов')
        .optional()
        .or(z.literal('')),
    targetDays: z
        .number()
        .int('Целевой период должен быть целым числом')
        .positive('Целевой период должен быть больше нуля')
        .max(3650, 'Целевой период не должен превышать 3650 дней')
        .optional(),
});

export type CreateZeroInjuryProgramFormData = z.infer<typeof createZeroInjuryProgramSchema>;
export type UpdateZeroInjuryProgramFormData = z.infer<typeof updateZeroInjuryProgramSchema>;