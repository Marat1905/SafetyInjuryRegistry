/**
 * Хук для загрузки статуса и истории программы «Ноль травм».
 * Предоставляет функцию refresh() для ручного обновления данных.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { safetyService } from '../../services/greenCross/api';
import type { ZeroInjuryProgramDto, ZeroInjuryStatusDto } from '../../types/greenCross';

export const useZeroInjuryProgram = () => {
    const [status, setStatus] = useState<ZeroInjuryStatusDto | null>(null);
    const [history, setHistory] = useState<ZeroInjuryProgramDto[]>([]);
    const [loading, setLoading] = useState(false);
    const cancelledRef = useRef(false);

    const fetchAll = useCallback(async (background = false) => {
        if (!background) setLoading(true);
        try {
            const [statusData, historyData] = await Promise.all([
                safetyService.getZeroInjuryStatus(),
                safetyService.getZeroInjuryHistory(),
            ]);
            if (!cancelledRef.current) {
                setStatus(statusData);
                setHistory(historyData);
            }
        } catch (err) {
            // Второстепенные данные — не показываем ошибку пользователю.
            console.error('Ошибка загрузки программы «Ноль травм»:', err);
        } finally {
            if (!background && !cancelledRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        cancelledRef.current = false;
        fetchAll(false);

        // Фоновая синхронизация раз в 5 минут.
        const intervalId = setInterval(() => fetchAll(true), 300000);

        return () => {
            cancelledRef.current = true;
            clearInterval(intervalId);
        };
    }, [fetchAll]);

    const refresh = useCallback(() => fetchAll(false), [fetchAll]);

    return { status, history, loading, refresh };
};