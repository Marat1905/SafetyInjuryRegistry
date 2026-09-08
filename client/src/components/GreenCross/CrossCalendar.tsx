/**
 * Компонент "Зелёный крест" – сетка 7x7, в которой активны только клетки, образующие крест.
 * Каждая клетка соответствует дню месяца (максимум 31 день, распределённые по кресту).
 * Цвет ячейки зависит от наличия травмы и её категории.
 */
import React, { useMemo } from 'react';
import { getDaysInMonth, setDate, isFuture, isToday } from 'date-fns';
import { getCategoryColorClass } from '../../utils/greenCross/injuryHelpers';
import type { InjuryDto } from '../../types/greenCross';

interface CrossCalendarProps {
    currentDate: Date;
    injuriesMonth: InjuryDto[];
    onDayClick: (date: Date) => void;
}

const CrossCalendar: React.FC<CrossCalendarProps> = ({
    currentDate,
    injuriesMonth,
    onDayClick,
}) => {
    // Количество дней в текущем месяце
    const monthDays = useMemo(() => {
        return Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => i + 1);
    }, [currentDate]);

    // Координаты клеток, образующих крест (7x7, где центральные строки и столбцы)
    const crossCells = useMemo(() => {
        const cells: { row: number; col: number }[] = [];
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < 7; col++) {
                if ((row >= 2 && row <= 4) || (col >= 2 && col <= 4)) {
                    cells.push({ row, col });
                }
            }
        }
        cells.sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
        return cells;
    }, []);

    // Отображение дней месяца на клетки креста (заполнение слева направо, сверху вниз)
    const cellContent = useMemo(() => {
        const content: Record<string, { day: number; date: Date; injury?: InjuryDto }> = {};
        const daysInMonth = monthDays.length;
        const totalCells = crossCells.length;
        const cellValues: (number | null)[] = new Array(totalCells).fill(null);

        // Особое размещение для месяцев с 31 днём (30-й и 31-й дни)
        if (daysInMonth === 31) {
            for (let i = 0; i < 30; i++) cellValues[i] = monthDays[i];
            cellValues[31] = monthDays[30];
        } else {
            for (let i = 0; i < daysInMonth; i++) cellValues[i] = monthDays[i];
        }

        crossCells.forEach((cell, index) => {
            const dayNumber = cellValues[index];
            if (dayNumber !== null) {
                const date = setDate(currentDate, dayNumber);
                const injury = injuriesMonth.find((inj) => {
                    const injDate = new Date(inj.date);
                    return (
                        injDate.getFullYear() === date.getFullYear() &&
                        injDate.getMonth() === date.getMonth() &&
                        injDate.getDate() === date.getDate()
                    );
                });
                content[`${cell.row}-${cell.col}`] = { day: dayNumber, date, injury };
            }
        });
        return content;
    }, [crossCells, monthDays, injuriesMonth, currentDate]);

    const handleCellClick = (row: number, col: number) => {
        const key = `${row}-${col}`;
        const cell = cellContent[key];
        if (cell) onDayClick(cell.date);
    };

    // Строим сетку 7x7
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 md:p-6">
            <div className="grid grid-cols-7 gap-2 md:gap-3">
                {Array.from({ length: 7 }, (_, row) =>
                    Array.from({ length: 7 }, (_, col) => {
                        const key = `${row}-${col}`;
                        const cell = cellContent[key];
                        const isCross = crossCells.some((c) => c.row === row && c.col === col);
                        if (!isCross) return <div key={key} className="aspect-square" />;

                        const dayNumber = cell?.day;
                        const cellDate = cell?.date;
                        const injury = cell?.injury;
                        const isFutureDate = cellDate ? isFuture(cellDate) : false;
                        const isTodayDate = cellDate ? isToday(cellDate) : false;

                        let bgColor = 'bg-gray-100 dark:bg-gray-700';
                        if (dayNumber) {
                            if (isFutureDate) {
                                bgColor = 'bg-gray-300 dark:bg-gray-600';
                            } else if (injury) {
                                bgColor = getCategoryColorClass(injury.category, true);
                            } else {
                                bgColor = 'bg-gradient-to-br from-green-400 to-emerald-600 dark:from-green-600 dark:to-emerald-800 shadow-md shadow-green-200/50 dark:shadow-green-900/30';
                            }
                        }

                        const todayClass = isTodayDate && dayNumber
                            ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800'
                            : '';

                        const isClickable = !!(dayNumber && !isFutureDate);

                        return (
                            <button
                                key={key}
                                className={`aspect-square flex items-center justify-center rounded-xl transition-all duration-200 ${bgColor} ${todayClass} ${isClickable
                                    ? 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95'
                                    : 'cursor-not-allowed opacity-70'
                                    }`}
                                onClick={() => isClickable && handleCellClick(row, col)}
                                title={
                                    injury
                                        ? `Тип: ${injury.type}\nКатегория: ${injury.category}\nОписание: ${injury.description}`
                                        : isFutureDate
                                            ? 'Будущий день'
                                            : ''
                                }
                                disabled={!isClickable}
                            >
                                {dayNumber && <span className="text-base md:text-lg font-bold text-white drop-shadow-md">{dayNumber}</span>}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CrossCalendar;