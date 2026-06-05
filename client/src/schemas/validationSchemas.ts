import { z } from 'zod';

/**
 * Схема валидации для создания новой травмы
 */
export const createInjurySchema = z.object({
    type: z.string().min(1, 'Тип травмы обязателен').max(200, 'Тип не должен превышать 200 символов'),
    description: z.string().min(1, 'Описание обязательно').max(1000, 'Описание не должно превышать 1000 символов'),
    category: z.string().min(1, 'Выберите категорию происшествия'),
});

/**
 * Схема валидации для обновления травмы (все поля опциональны, но если указаны – проходят валидацию)
 */
export const updateInjurySchema = z.object({
    type: z.string().min(1, 'Тип не может быть пустым').max(200, 'Тип не должен превышать 200 символов').optional(),
    description: z.string().min(1, 'Описание не может быть пустым').max(1000, 'Описание не должно превышать 1000 символов').optional(),
    category: z.string().optional(),
});

// Типы для форм (экспортируем для использования в компонентах)
export type CreateInjuryFormData = z.infer<typeof createInjurySchema>;
export type UpdateInjuryFormData = z.infer<typeof updateInjurySchema>;