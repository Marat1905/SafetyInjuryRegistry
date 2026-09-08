/**
 * Годовой календарь: отображает все 12 месяцев в виде сетки.
 * Каждый месяц отрисовывается компонентом MonthView.
 */
import React from 'react';
import MonthView from './MonthView';
import type { InjuryDto } from '../../types/greenCross';

interface YearCalendarViewProps {
    year: number;
    injuriesYear: InjuryDto[];
    onDayClick: (date: Date) => void;
}

const YearCalendarView: React.FC<YearCalendarViewProps> = ({
    year,
    injuriesYear,
    onDayClick,
}) => {
    const months = Array.from({ length: 12 }, (_, i) => i);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 text-center">
                {year} год
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {months.map((month) => (
                    <MonthView
                        key={month}
                        year={year}
                        monthIndex={month}
                        injuriesYear={injuriesYear}
                        onDayClick={onDayClick}
                    />
                ))}
            </div>
        </div>
    );
};

export default YearCalendarView;