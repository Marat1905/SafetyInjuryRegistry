import axios from 'axios';
import type {
    InjuryDto,
    CreateInjuryRequest,
    UpdateInjuryRequest,
    InjuryFileDto,
} from '../../types/greenCross/index';
import {
    requestInterceptor,
    requestErrorInterceptor,
    responseInterceptor,
    responseErrorInterceptor,
} from '../axiosInterceptors';

const API_BASE_URL = '/safety/api/v1';

// Создаём экземпляр axios с базовым URL и общими заголовками
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Применяем кастомные интерцепторы проекта
apiClient.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
apiClient.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

/**
 * Сервис для работы с травмами (Green Cross)
 */
export const safetyService = {
    /**
     * Получить травмы за указанный месяц
     * @param year - год (например, 2025)
     * @param month - месяц (1–12)
     */
    async getByMonth(year: number, month: number): Promise<InjuryDto[]> {
        const response = await apiClient.get<InjuryDto[]>('/injuries', {
            params: { year, month },
        });
        return response.data;
    },

    /**
     * Получить травмы за указанный год
     * @param year - год
     */
    async getByYear(year: number): Promise<InjuryDto[]> {
        const response = await apiClient.get<InjuryDto[]>(`/injuries/year/${year}`);
        return response.data;
    },

    /**
     * Получить самую последнюю травму (любую категорию)
     */
    async getLatest(): Promise<InjuryDto | null> {
        try {
            const response = await apiClient.get<InjuryDto>('/injuries/latest');
            return response.data;
        } catch {
            return null;
        }
    },

    /**
     * Получить последнюю травму категорий П1 (Fatality) или П2 (LostWorkdayCase)
     * Используется для сброса счётчика дней без травм
     */
    async getLatestSignificant(): Promise<InjuryDto | null> {
        try {
            const response = await apiClient.get<InjuryDto>('/injuries/latest/significant');
            return response.data;
        } catch {
            return null;
        }
    },

    /**
     * Создать новую запись о травме
     * @param data - данные для создания
     */
    async create(data: CreateInjuryRequest): Promise<InjuryDto> {
        const response = await apiClient.post<InjuryDto>('/injuries', data);
        return response.data;
    },

    /**
     * Обновить существующую травму
     * @param id - идентификатор травмы
     * @param data - новые данные
     */
    async update(id: string, data: UpdateInjuryRequest): Promise<InjuryDto> {
        const response = await apiClient.put<InjuryDto>(`/injuries/${id}`, data);
        return response.data;
    },

    /**
     * Удалить травму
     * @param id - идентификатор травмы
     */
    async delete(id: string): Promise<void> {
        await apiClient.delete(`/injuries/${id}`);
    },

    // ========== Методы для работы с файлами травм ==========

    /**
     * Получить список всех файлов для конкретной травмы
     * @param injuryId - идентификатор травмы
     */
    async getFiles(injuryId: string): Promise<InjuryFileDto[]> {
        const response = await apiClient.get<InjuryFileDto[]>(`/injuries/${injuryId}/files`);
        return response.data;
    },

    /**
     * Загрузить новый файл для травмы
     * @param injuryId - идентификатор травмы
     * @param file - файл для загрузки
     * @param description - описание файла (необязательно)
     */
    async uploadFile(
        injuryId: string,
        file: File,
        description?: string
    ): Promise<InjuryFileDto> {
        const formData = new FormData();
        formData.append('file', file);

        if (description) {
            formData.append('description', description);
        }

        const response = await apiClient.post<InjuryFileDto>(
            `/injuries/${injuryId}/files`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        return response.data;
    },

    /**
     * Скачать файл
     * @param injuryId - идентификатор травмы
     * @param fileId - идентификатор файла
     * @returns Promise<Blob> - содержимое файла
     */
    async downloadFile(injuryId: string, fileId: string): Promise<Blob> {
        const response = await apiClient.get(
            `/injuries/${injuryId}/files/${fileId}`,
            {
                responseType: 'blob',
            }
        );

        return response.data;
    },

    /**
     * Удалить файл
     * @param injuryId - идентификатор травмы
     * @param fileId - идентификатор файла
     */
    async deleteFile(injuryId: string, fileId: string): Promise<void> {
        await apiClient.delete(`/injuries/${injuryId}/files/${fileId}`);
    },

    /**
     * Получить статистику по значимым травмам (П1/П2) за указанные месяц и год
     * @param year - год
     * @param month - месяц (1-12)
     */
    async getStatistics(
        year: number,
        month: number
    ): Promise<{
        monthSignificantCount: number;
        yearSignificantCount: number;
        lastSignificantDate: string | null;
        daysWithoutInjury: number;
    }> {
        const response = await apiClient.get('/injuries/statistics', {
            params: { year, month },
        });

        return response.data;
    },

    // ========== Метод для получения названия организации ==========

    /**
     * Получить расшифрованное название организации
     * @returns название организации или пустую строку при ошибке
     */
    async getOrganizationName(): Promise<string> {
        try {
            const response = await apiClient.get<{ organizationName: string }>(
                '/organization/name'
            );

            return response.data.organizationName;
        } catch (error) {
            console.error('Ошибка при получении названия организации:', error);
            return '';
        }
    },

    // ========== Метод для получения версии API ==========

    /**
     * Получить информацию о версии запущенного приложения
     * @returns объект с версией, окружением, датой сборки и хэшем коммита
     */
    async getVersion(): Promise<{
        applicationName: string;
        version: string;
        environment: string;
        gitCommit: string;
        buildDate: string;
    }> {
        const response = await apiClient.get('/version');
        return response.data;
    },
    /**
 * Получить статус программы «Ноль травм»: активная программа, последняя значимая травма,
 * минимально допустимая дата начала новой программы.
 */
    async getZeroInjuryStatus(): Promise<import('../../types/greenCross').ZeroInjuryStatusDto> {
        const response = await apiClient.get('/zero-injury/status');
        return response.data;
    },

    /**
     * Получить историю программ «Ноль травм» (от новых к старым).
     */
    async getZeroInjuryHistory(): Promise<import('../../types/greenCross').ZeroInjuryProgramDto[]> {
        const response = await apiClient.get('/zero-injury/history');
        return response.data;
    },

    /**
     * Получить одну программу по идентификатору.
     * @param id - идентификатор программы
     */
    async getZeroInjuryProgramById(id: string): Promise<import('../../types/greenCross').ZeroInjuryProgramDto> {
        const response = await apiClient.get(`/zero-injury/${id}`);
        return response.data;
    },

    /**
     * Создать новую программу «Ноль травм».
     * @param data - параметры новой программы
     */
    async createZeroInjuryProgram(
        data: import('../../types/greenCross').CreateZeroInjuryProgramRequest
    ): Promise<import('../../types/greenCross').ZeroInjuryProgramDto> {
        const response = await apiClient.post('/zero-injury', data);
        return response.data;
    },

    /**
     * Обновить существующую активную программу.
     * @param id - идентификатор программы
     * @param data - новые значения полей
     */
    async updateZeroInjuryProgram(
        id: string,
        data: import('../../types/greenCross').UpdateZeroInjuryProgramRequest
    ): Promise<import('../../types/greenCross').ZeroInjuryProgramDto> {
        const response = await apiClient.put(`/zero-injury/${id}`, data);
        return response.data;
    },

    /**
     * Удалить программу «Ноль травм» вместе с документами.
     * @param id - идентификатор программы
     */
    async deleteZeroInjuryProgram(id: string): Promise<void> {
        await apiClient.delete(`/zero-injury/${id}`);
    },

    /**
     * Получить список документов программы.
     * @param programId - идентификатор программы
     */
    async getZeroInjuryDocuments(
        programId: string
    ): Promise<import('../../types/greenCross').ZeroInjuryDocumentDto[]> {
        const response = await apiClient.get(`/zero-injury/${programId}/documents`);
        return response.data;
    },

    /**
     * Загрузить документ в программу.
     * @param programId - идентификатор программы
     * @param file - файл
     * @param documentType - тип документа (Order, Act, Report, Other)
     * @param description - описание (необязательно)
     */
    async uploadZeroInjuryDocument(
        programId: string,
        file: File,
        documentType: string,
        description?: string
    ): Promise<import('../../types/greenCross').ZeroInjuryDocumentDto> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', documentType);
        if (description) {
            formData.append('description', description);
        }

        const response = await apiClient.post(
            `/zero-injury/${programId}/documents`,
            formData,
            {
                headers: { 'Content-Type': 'multipart/form-data' },
            }
        );
        return response.data;
    },

    /**
     * Скачать документ программы.
     */
    async downloadZeroInjuryDocument(programId: string, documentId: string): Promise<Blob> {
        const response = await apiClient.get(
            `/zero-injury/${programId}/documents/${documentId}`,
            { responseType: 'blob' }
        );
        return response.data;
    },

    /**
     * Удалить документ программы.
     */
    async deleteZeroInjuryDocument(programId: string, documentId: string): Promise<void> {
        await apiClient.delete(`/zero-injury/${programId}/documents/${documentId}`);
    },
};

export default safetyService;