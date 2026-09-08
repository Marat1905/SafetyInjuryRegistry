/**
 * Хук для управления навигацией по месяцам (в режиме креста) или годам (в режиме года).
 * Возвращает текущую дату (startOfMonth для креста, и просто дату с годом для года),
 * а также функции goPrev/goNext, которые изменяют дату в зависимости от viewMode.
 */
import { useState, useCallback } from 'react';
import { startOfMonth, setYear, getYear } from 'date-fns';

export const useNavigation = (viewMode: 'cross' | 'year') => {
    // Для креста храним начало месяца, для года – любой день внутри года (используем 1 января)
    const [currentDate, setCurrentDate] = useState(() => startOfMonth(new Date()));

    const goPrev = useCallback(() => {
        setCurrentDate((prev) => {
            if (viewMode === 'cross') {
                const newDate = new Date(prev);
                newDate.setMonth(newDate.getMonth() - 1);
                return startOfMonth(newDate);
            } else {
                // Год назад
                return setYear(prev, getYear(prev) - 1);
            }
        });
    }, [viewMode]);

    const goNext = useCallback(() => {
        setCurrentDate((prev) => {
            if (viewMode === 'cross') {
                const newDate = new Date(prev);
                newDate.setMonth(newDate.getMonth() + 1);
                return startOfMonth(newDate);
            } else {
                return setYear(prev, getYear(prev) + 1);
            }
        });
    }, [viewMode]);

    return { currentDate, goPrev, goNext };
};