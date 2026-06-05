/**
 * Панель статистики: количество травм П1+П2 за месяц, за год, дни без травм.
 */
import React, { useMemo } from 'react';
import { differenceInCalendarDays, startOfDay, format } from 'date-fns';
import { FiCalendar, FiActivity, FiClock } from 'react-icons/fi';
import { isSignificantCategory } from '../../utils/injuryHelpers';
import type { InjuryDto } from '../../types';

interface StatsPanelProps {
    injuriesMonth: InjuryDto[];
    injuriesYear: InjuryDto[];
    latestSignificantInjury: InjuryDto | null;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
    injuriesMonth,
    injuriesYear,
    latestSignificantInjury,
}) => {
    const stats = useMemo(() => {
        const monthSignificant = injuriesMonth.filter((inj) => isSignificantCategory(inj.category));
        const yearSignificant = injuriesYear.filter((inj) => isSignificantCategory(inj.category));

        let daysWithoutInjury = 0;
        let lastSignificantDate: Date | null = null;

        if (latestSignificantInjury) {
            const lastDate = new Date(latestSignificantInjury.date);
            const today = startOfDay(new Date());
            daysWithoutInjury = differenceInCalendarDays(today, lastDate) - 1;
            if (daysWithoutInjury < 0) daysWithoutInjury = 0;
            lastSignificantDate = lastDate;
        }

        return {
            monthInjuries: monthSignificant.length,
            yearInjuries: yearSignificant.length,
            daysWithoutInjury,
            lastSignificantDate,
        };
    }, [injuriesMonth, injuriesYear, latestSignificantInjury]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center">
                <FiActivity className="mr-2 text-green-500" /> Статистика (П1+П2)
            </h2>
            <div className="space-y-4">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                        <FiCalendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Травм П1-П2 за месяц</div>
                        <div className="text-3xl font-bold text-gray-800 dark:text-white">{stats.monthInjuries}</div>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                        <FiActivity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Травм П1-П2 за год</div>
                        <div className="text-3xl font-bold text-gray-800 dark:text-white">{stats.yearInjuries}</div>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                        <FiClock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Дней без травм (П1+П2)</div>
                        <div className="text-3xl font-bold text-gray-800 dark:text-white">{stats.daysWithoutInjury}</div>
                        {stats.lastSignificantDate && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Последняя травма: {format(stats.lastSignificantDate, 'dd.MM.yyyy')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPanel;