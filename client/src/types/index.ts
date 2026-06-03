export interface InjuryDto {
    /** Уникальный идентификатор */
    id: string;
    /** Дата происшествия в формате ISO (YYYY-MM-DDTHH:mm:ss.sssZ) */
    date: string;
    /** Тип травмы (например, "порез", "ушиб") */
    type: string;
    /** Подробное описание */
    description: string;
}

/**
 * Запрос на создание новой травмы
 */
export interface CreateInjuryRequest {
    /** Дата происшествия в формате ISO */
    date: string;
    /** Тип травмы */
    type: string;
    /** Описание */
    description: string;
}

/**
 * Запрос на обновление существующей травмы
 */
export interface UpdateInjuryRequest {
    /** Тип травмы */
    type: string;
    /** Описание */
    description: string;
}

/**
 * Информация о файле, прикреплённом к травме
 */
export interface InjuryFileDto {
    /** Идентификатор файла */
    id: string;
    /** Идентификатор травмы */
    injuryId: string;
    /** Оригинальное имя файла */
    fileName: string;
    /** MIME-тип */
    contentType: string;
    /** Размер в байтах */
    size: number;
    /** Описание файла (необязательно) */
    description?: string;
    /** Дата загрузки */
    createdAt: string; // ISO строка
}