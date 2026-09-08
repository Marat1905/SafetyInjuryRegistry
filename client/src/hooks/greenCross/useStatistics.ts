/**
 * Хук для загрузки статистики по значимым травмам (П1/П2).
 * Обновляется при изменении года/месяца или по требованию.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { safetyService } from '../../services/greenCross/api';

interface StatisticsData {
    monthSignificantCount: number;
    yearSignificantCount: number;
    lastSignificantDate: string | null;
    daysWithoutInjury: number;
}

export const useStatistics = (year: number, month: number) => {
    const [statistics, setStatistics] = useState<StatisticsData>({
        monthSignificantCount: 0,
        yearSignificantCount: 0,
        lastSignificantDate: null,
        daysWithoutInjury: 0,
    });
    const [loading, setLoading] = useState(false);
    const yearRef = useRef(year);
    const monthRef = useRef(month);

    useEffect(() => {
        yearRef.current = year;
        monthRef.current = month;
    }, [year, month]);

    const fetchStatistics = useCallback(async (background = false) => {
        if (!background) setLoading(true);
        try {
            const data = await safetyService.getStatistics(yearRef.current, monthRef.current);
            setStatistics(data);
        } catch (error) {
            console.error('Ошибка при загрузке статистики:', error);
        } finally {
            if (!background) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatistics(false);
    }, [year, month, fetchStatistics]);

    const refreshStatistics = useCallback(() => fetchStatistics(false), [fetchStatistics]);

    return { statistics, loading, refreshStatistics };
};