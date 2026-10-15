/**
 * Типы данных для работы с программой «Ноль травм» (365 дней без травм).
 * Дублируют DTOs бэкенда.
 */

export type ZeroInjuryProgramStatus = 'Active' | 'Completed' | 'Interrupted';

export type ZeroInjuryDocumentType = 'Order' | 'Act' | 'Report' | 'Other';

/** DTO программы «Ноль травм» */
export interface ZeroInjuryProgramDto {
    /** Уникальный идентификатор программы */
    id: string;
    /** Дата начала периода (ISO) */
    startDate: string;
    /** Идентификатор травмы-триггера (П1/П2) или null */
    triggeringInjuryId: string | null;
    /** Описание / основание */
    description: string;
    /** Целевое количество дней (обычно 365) */
    targetDays: number;
    /** Сколько дней прошло с начала периода */
    daysPassed: number;
    /** Сколько дней осталось до планового завершения */
    daysRemaining: number;
    /** Статус: Active / Completed / Interrupted */
    status: ZeroInjuryProgramStatus;
    /** Флаг завершения (успешного или с прерыванием) */
    isCompleted: boolean;
    /** Флаг успешного завершения */
    isSuccessfullyCompleted: boolean;
    /** Идентификатор прервавшей травмы (если была) */
    interruptingInjuryId: string | null;
    /** Дата фактического завершения (если завершена) */
    completedAt: string | null;
    /** ID пользователя, установившего отсчёт */
    setByUserId: string;
    /** Имя пользователя, установившего отсчёт */
    setByUserName: string;
    /** Список прикреплённых документов */
    documents: ZeroInjuryDocumentDto[];
    /** Дата создания записи */
    createdAt: string;
    /** Дата последнего обновления */
    updatedAt: string | null;
}

/** DTO документа программы */
export interface ZeroInjuryDocumentDto {
    id: string;
    programId: string;
    fileName: string;
    contentType: string;
    size: number;
    description?: string | null;
    documentType: ZeroInjuryDocumentType;
    createdAt: string;
}

/** Запрос на создание программы */
export interface CreateZeroInjuryProgramRequest {
    startDate: string;
    description: string;
    targetDays: number;
}

/** Запрос на обновление программы */
export interface UpdateZeroInjuryProgramRequest {
    startDate?: string;
    description?: string;
    targetDays?: number;
}

/** Сводный статус программы */
export interface ZeroInjuryStatusDto {
    currentProgram: ZeroInjuryProgramDto | null;
    lastFinalizedProgram: ZeroInjuryProgramDto | null;
    lastSignificantInjuryDate: string | null;
    nextAllowedStartDate: string | null;
    canStartNew: boolean;
}