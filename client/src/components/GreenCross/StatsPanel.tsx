/**
 * Панель статистики: количество травм П1+П2 за месяц, за год, дни без травм.
 * Теперь получает данные через пропс statistics из бэкенда.
 */
import React from 'react';
import { format } from 'date-fns';
import { FiCalendar, FiActivity, FiClock } from 'react-icons/fi';

interface Statistics {
    monthSignificantCount: number;
    yearSignificantCount: number;
    lastSignificantDate: string | null;
    daysWithoutInjury: number;
}

interface StatsPanelProps {
    statistics: Statistics;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ statistics }) => {
    const {
        monthSignificantCount,
        yearSignificantCount,
        lastSignificantDate,
        daysWithoutInjury,
    } = statistics;

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
                        <div className="text-3xl font-bold text-gray-800 dark:text-white">{monthSignificantCount}</div>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                        <FiActivity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Травм П1-П2 за год</div>
                        <div className="text-3xl font-bold text-gray-800 dark:text-white">{yearSignificantCount}</div>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                        <FiClock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Дней без травм (П1+П2)</div>
                        <div className="text-3xl font-bold text-gray-800 dark:text-white">{daysWithoutInjury}</div>
                        {lastSignificantDate && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Последняя травма: {format(new Date(lastSignificantDate), 'dd.MM.yyyy')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPanel;