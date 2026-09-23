import { useEffect, useState } from 'react';
import { safetyService } from '../../services/greenCross/api';

/**
 * Хук для получения версии бэкенда (Safety.Injuries.API).
 *
 * Загружает данные с эндпоинта `/safety/api/v1/version` (VersionController)
 * один раз при монтировании компонента и возвращает только строку версии.
 *
 * Хук безопасен при размонтировании: если компонент был удалён до того,
 * как запрос завершился, состояние не будет обновлено.
 *
 * @returns Строка версии бэкенда или `null`, пока данные не загружены
 *          (либо если запрос завершился ошибкой).
 *
 * @example
 * ```tsx
 * const version = useBackendVersion();
 * // ...
 * {version && <span>v{version}</span>}
 * ```
 */
export function useBackendVersion(): string | null {
    // Версия бэкенда (null, пока не загружена)
    const [version, setVersion] = useState<string | null>(null);

    useEffect(() => {
        // Флаг отмены — предотвращает обновление состояния после размонтирования
        let cancelled = false;

        const fetchVersion = async () => {
            try {
                const data = await safetyService.getVersion();
                if (!cancelled) {
                    setVersion(data.version);
                }
            } catch (err) {
                // Версия — второстепенная информация, поэтому не показываем
                // пользователю ошибку, только логируем в консоль.
                console.error('Не удалось загрузить версию бэкенда:', err);
            }
        };

        fetchVersion();

        return () => {
            cancelled = true;
        };
    }, []);

    return version;
}