import axios from 'axios';
import type { InjuryDto, CreateInjuryRequest, UpdateInjuryRequest, InjuryFileDto } from '../types/index';

const API_BASE_URL = '/api';

// Создаём экземпляр axios с базовым URL и общими заголовками
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ----------------------------------------------------------------------
// Интерцепторы запросов
// ----------------------------------------------------------------------

/**
 * Request interceptor: добавляет токен авторизации из localStorage
 */
const requestInterceptor = (config: any) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
};

const requestErrorInterceptor = (error: any) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
};

// ----------------------------------------------------------------------
// Интерцепторы ответов
// ----------------------------------------------------------------------

/**
 * Response interceptor: обрабатывает успешные ответы
 */
const responseInterceptor = (response: any) => {
    return response;
};

/**
 * Response error interceptor: обрабатывает ошибки (401, 403, 500 и т.д.)
 */
const responseErrorInterceptor = (error: any) => {
    if (error.response) {
        const { status, data } = error.response;
        if (status === 401) {
            // Неавторизован – очищаем токен и перенаправляем на страницу входа
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        } else if (status === 403) {
            console.error('Доступ запрещён', data);
        } else if (status === 404) {
            console.warn('Ресурс не найден', data);
        } else {
            console.error(`Ошибка сервера (${status}):`, data);
        }
    } else if (error.request) {
        console.error('Сервер не отвечает:', error.request);
    } else {
        console.error('Ошибка при настройке запроса:', error.message);
    }
    return Promise.reject(error);
};

// Применяем интерцепторы
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
        const response = await apiClient.get<InjuryDto[]>('/safety/injuries', {
            params: { year, month }
        });
        return response.data;
    },

    /**
     * Получить травмы за указанный год
     * @param year - год
     */
    async getByYear(year: number): Promise<InjuryDto[]> {
        const response = await apiClient.get<InjuryDto[]>(`/safety/injuries/year/${year}`);
        return response.data;
    },

    /**
     * Получить самую последнюю травму
     */
    async getLatest(): Promise<InjuryDto | null> {
        try {
            const response = await apiClient.get<InjuryDto>('/safety/injuries/latest');
            return response.data;
        } catch {
            return null; // если 404 или ошибка – возвращаем null
        }
    },

    /**
     * Создать новую запись о травме
     * @param data - данные для создания
     */
    async create(data: CreateInjuryRequest): Promise<InjuryDto> {
        const response = await apiClient.post<InjuryDto>('/safety/injuries', data);
        return response.data;
    },

    /**
     * Обновить существующую травму
     * @param id - идентификатор травмы
     * @param data - новые данные
     */
    async update(id: string, data: UpdateInjuryRequest): Promise<InjuryDto> {
        const response = await apiClient.put<InjuryDto>(`/safety/injuries/${id}`, data);
        return response.data;
    },

    /**
     * Удалить травму
     * @param id - идентификатор травмы
     */
    async delete(id: string): Promise<void> {
        await apiClient.delete(`/safety/injuries/${id}`);
    },

    // ========== Методы для работы с файлами травм ==========

    /**
     * Получить список всех файлов для конкретной травмы
     * @param injuryId - идентификатор травмы
     */
    async getFiles(injuryId: string): Promise<InjuryFileDto[]> {
        const response = await apiClient.get<InjuryFileDto[]>(`/safety/injuries/${injuryId}/files`);
        return response.data;
    },

    /**
     * Загрузить новый файл для травмы
     * @param injuryId - идентификатор травмы
     * @param file - файл для загрузки
     * @param description - описание файла (необязательно)
     */
    async uploadFile(injuryId: string, file: File, description?: string): Promise<InjuryFileDto> {
        const formData = new FormData();
        formData.append('file', file);
        if (description) {
            formData.append('description', description);
        }

        const response = await apiClient.post<InjuryFileDto>(`/safety/injuries/${injuryId}/files`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    /**
     * Скачать файл
     * @param injuryId - идентификатор травмы
     * @param fileId - идентификатор файла
     * @returns Promise<Blob> - содержимое файла
     */
    async downloadFile(injuryId: string, fileId: string): Promise<Blob> {
        const response = await apiClient.get(`/safety/injuries/${injuryId}/files/${fileId}`, {
            responseType: 'blob',
        });
        return response.data;
    },

    /**
     * Удалить файл
     * @param injuryId - идентификатор травмы
     * @param fileId - идентификатор файла
     */
    async deleteFile(injuryId: string, fileId: string): Promise<void> {
        await apiClient.delete(`/safety/injuries/${injuryId}/files/${fileId}`);
    },
};

export default safetyService;