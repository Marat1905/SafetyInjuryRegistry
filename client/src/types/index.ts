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