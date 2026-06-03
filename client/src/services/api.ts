import axios from 'axios';
import type { InjuryDto, CreateInjuryRequest, UpdateInjuryRequest } from '../types/index';
import {
    requestInterceptor,
    requestErrorInterceptor,
    responseInterceptor,
    responseErrorInterceptor
} from './axiosInterceptors'; // Убедитесь, что путь к интерцепторам корректен

const API_BASE_URL = '/api';

// Создаём экземпляр axios с базовым URL и общими заголовками
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Применяем интерцепторы (аутентификация, обработка ошибок и т.д.)
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

    // Новый метод – получение самой последней травмы
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
};

export default safetyService;