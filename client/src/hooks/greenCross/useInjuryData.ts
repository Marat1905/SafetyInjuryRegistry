/**
 * Хук для загрузки данных о травмах:
 * - травмы за месяц (по текущей дате)
 * - травмы за год
 * Также обеспечивает фоновую синхронизацию каждые 10 минут.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { safetyService } from '../../services/greenCross/api';
import type { InjuryDto } from '../../types/greenCross';

export const useInjuryData = (currentDate: Date) => {
    const [injuriesMonth, setInjuriesMonth] = useState<InjuryDto[]>([]);
    const [injuriesYear, setInjuriesYear] = useState<InjuryDto[]>([]);
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
            const [monthData, yearData] = await Promise.all([
                safetyService.getByMonth(year, month),
                safetyService.getByYear(year),
            ]);
            setInjuriesMonth(monthData);
            setInjuriesYear(yearData);
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

    return {
        injuriesMonth,
        injuriesYear,
        loading,
        refetch: () => fetchData(false),
    };
};