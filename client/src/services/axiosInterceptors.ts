import axios, { type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

/**
 * Request interceptor: добавляет токен авторизации из localStorage.
 * В текущем проекте используется ключ 'access_token'.
 * Дополнительно поддерживаем 'accessToken' на случай миграции.
 */
export const requestInterceptor = (
    config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
    const token =
        localStorage.getItem('access_token') ||
        localStorage.getItem('accessToken');

    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Для FormData не устанавливаем Content-Type вручную,
    // чтобы браузер сам добавил boundary.
    if (config.data instanceof FormData) {
        delete (config.headers as any)['Content-Type'];
    }

    return config;
};

export const requestErrorInterceptor = (error: any) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
};

/**
 * Response interceptor: успешные ответы проходят без изменений.
 */
export const responseInterceptor = (response: AxiosResponse) => {
    return response;
};

/**
 * Response error interceptor: обрабатывает ошибки (401, 403, 404, 500 и т.д.).
 * При 401 показывает тост, удаляет токен и перенаправляет на страницу входа.
 */
export const responseErrorInterceptor = (error: any) => {
    if (error.response) {
        const { status, data } = error.response;

        if (status === 401) {
            toast.error('Сессия истекла. Пожалуйста, войдите заново.');

            localStorage.removeItem('access_token');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');

            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);

            return Promise.reject(error);
        }

        if (status === 403) {
            toast.error('У вас нет прав для выполнения этого действия.');
        } else if (status === 404) {
            console.warn('Ресурс не найден', data);
        } else {
            console.error(`Ошибка сервера (${status}):`, data);
        }
    } else if (error.request) {
        console.error('Сервер не отвечает:', error.request);
        toast.error('Сервер временно недоступен. Попробуйте позже.');
    } else {
        console.error('Ошибка при настройке запроса:', error.message);
    }

    return Promise.reject(error);
};