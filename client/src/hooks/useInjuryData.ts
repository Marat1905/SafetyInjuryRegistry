/**
 * Хук для загрузки данных о травмах:
 * - травмы за месяц (по текущей дате)
 * - травмы за год
 * - последняя значимая травма (П1/П2)
 * Также обеспечивает фоновую синхронизацию каждые 10 минут.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { startOfMonth } from 'date-fns';
import { safetyService } from '../services/api';
import type { InjuryDto } from '../types';

export const useInjuryData = (currentDate: Date) => {
    const [injuriesMonth, setInjuriesMonth] = useState<InjuryDto[]>([]);
    const [injuriesYear, setInjuriesYear] = useState<InjuryDto[]>([]);
    const [latestSignificantInjury, setLatestSignificantInjury] = useState<InjuryDto | null>(null);
    const [loading, setLoading] = useState(false);
    const currentDateRef = useRef(currentDate);

    useEffect(() => {
        currentDateRef.current = currentDate;
    }, [currentDate]);

    const fetchData = useCallback(async (background = false) => {
        const date = currentDateRef.current;
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        if (!background) setLoading(true);
        try {
            const [monthData, yearData, latestSig] = await Promise.all([
                safetyService.getByMonth(year, month),
                safetyService.getByYear(year),
                safetyService.getLatestSignificant(),
            ]);
            setInjuriesMonth(monthData);
            setInjuriesYear(yearData);
            setLatestSignificantInjury(latestSig);
        } catch (error) {
            console.error('Ошибка при обновлении данных:', error);
        } finally {
            if (!background) setLoading(false);
        }
    }, []);

    // Первоначальная загрузка и при изменении currentDate
    useEffect(() => {
        fetchData(false);
    }, [currentDate, fetchData]);

    // Фоновая синхронизация каждые 10 минут
    useEffect(() => {
        const intervalId = setInterval(() => fetchData(true), 600000);
        return () => clearInterval(intervalId);
    }, [fetchData]);

    const refreshLatestSignificant = useCallback(async () => {
        try {
            const latest = await safetyService.getLatestSignificant();
            setLatestSignificantInjury(latest);
        } catch (error) {
            console.error('Ошибка при обновлении последней значимой травмы', error);
        }
    }, []);

    return {
        injuriesMonth,
        injuriesYear,
        latestSignificantInjury,
        loading,
        refetch: () => fetchData(false),
        refreshLatestSignificant,
    };
};