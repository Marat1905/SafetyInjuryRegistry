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
};

export default safetyService;