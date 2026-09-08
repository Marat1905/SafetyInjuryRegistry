/**
 * Отображение одного месяца в годовом календаре.
 * Рисует сетку дней с указанием чисел и цветовой индикацией травм.
 */
import React from 'react';
import { format, getDaysInMonth, getDay, isFuture, isSameDay, getYear, getMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getCategoryColorClass } from '../../utils/greenCross/injuryHelpers';
import type { InjuryDto } from '../../types/greenCross';

interface MonthViewProps {
    year: number;
    monthIndex: number; // 0-11
    injuriesYear: InjuryDto[];
    onDayClick: (date: Date) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
    year,
    monthIndex,
    injuriesYear,
    onDayClick,
}) => {
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const daysInMonth = getDaysInMonth(firstDayOfMonth);
    const startWeekDay = getDay(firstDayOfMonth);
    const offset = startWeekDay === 0 ? 6 : startWeekDay - 1; // Понедельник – первый день недели

    const days: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);

    const getInjuryForDay = (day: number): InjuryDto | undefined => {
        const date = new Date(year, monthIndex, day);
        return injuriesYear.find((inj) => isSameDay(new Date(inj.date), date));
    };

    const today = new Date();
    const isCurrentMonth = year === getYear(today) && monthIndex === getMonth(today);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-2 border border-gray-100 dark:border-gray-700">
            <div className="text-center font-semibold text-sm mb-2 text-gray-700 dark:text-gray-300">
                {format(new Date(year, monthIndex, 1), 'LLLL', { locale: ru })}
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[0.6rem] text-gray-500 dark:text-gray-400 mb-1">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                    <div key={d}>{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {days.map((day, idx) => {
                    if (day === null) return <div key={idx} className="aspect-square" />;

                    const injury = getInjuryForDay(day);
                    const date = new Date(year, monthIndex, day);
                    const future = isFuture(date);
                    const isTodayDate = isCurrentMonth && day === today.getDate() && !future;

                    let bgColor = 'bg-gray-300 dark:bg-gray-600'; // будущий день
                    if (!future) {
                        if (injury) {
                            bgColor = getCategoryColorClass(injury.category, true);
                        } else {
                            bgColor = 'bg-gradient-to-br from-green-400 to-emerald-600 dark:from-green-600 dark:to-emerald-800';
                        }
                    }

                    const todayClass = isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800' : '';
                    const clickable = !future || !!injury;

                    return (
                        <button
                            key={idx}
                            className={`aspect-square flex items-center justify-center rounded-md text-[0.65rem] font-bold text-white ${bgColor} ${todayClass} ${clickable ? 'cursor-pointer hover:scale-105 hover:shadow-md active:scale-95' : 'cursor-not-allowed opacity-70'
                                }`}
                            onClick={() => clickable && onDayClick(date)}
                            disabled={!clickable}
                            title={
                                injury
                                    ? `Тип: ${injury.type}\nКатегория: ${injury.category}\nОписание: ${injury.description}`
                                    : future
                                        ? 'Будущий день'
                                        : 'Нет травмы'
                            }
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthView;