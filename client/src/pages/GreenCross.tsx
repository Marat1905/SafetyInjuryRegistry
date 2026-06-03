import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    format,
    getDaysInMonth,
    setDate,
    startOfMonth,
    differenceInCalendarDays,
    startOfYear,
    isSameDay,
    isToday,
    isFuture,
    startOfDay,
    getDay,
    setYear,
    getYear,
    getMonth,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    FiChevronLeft,
    FiChevronRight,
    FiX,
    FiTrash2,
    FiCalendar,
    FiActivity,
    FiClock,
    FiPlus,
    FiGrid,
    FiCalendar as FiYearIcon,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { safetyService } from '../services/api';
import type { InjuryDto } from '../types/index';

// ----------------------------------------------------------------------
// Вспомогательный компонент для отображения одного месяца в календаре года
// ----------------------------------------------------------------------
const MonthView: React.FC<{
    year: number;
    monthIndex: number;
    injuriesYear: InjuryDto[];
    onDayClick: (date: Date) => void;
}> = ({ year, monthIndex, injuriesYear, onDayClick }) => {
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const daysInMonth = getDaysInMonth(firstDayOfMonth);
    const startWeekDay = getDay(firstDayOfMonth); // 0 = воскресенье
    const offset = startWeekDay === 0 ? 6 : startWeekDay - 1; // подгон под понедельник

    const days: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
        days.push(d);
    }
    while (days.length % 7 !== 0) {
        days.push(null);
    }

    // Проверка, есть ли травма в этот день
    const hasInjury = (day: number): InjuryDto | undefined => {
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
                    if (day === null) {
                        return <div key={idx} className="aspect-square" />;
                    }

                    const injury = hasInjury(day);
                    const date = new Date(year, monthIndex, day);
                    const future = isFuture(date);
                    const isTodayDate = isCurrentMonth && day === today.getDate() && !future;

                    let bgColor = 'bg-gray-100 dark:bg-gray-700';
                    if (!future) {
                        bgColor = injury
                            ? 'bg-gradient-to-br from-red-400 to-red-600 dark:from-red-600 dark:to-red-800'
                            : 'bg-gradient-to-br from-green-400 to-emerald-600 dark:from-green-600 dark:to-emerald-800';
                    } else {
                        bgColor = 'bg-gray-300 dark:bg-gray-600';
                    }

                    const todayClass = isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800' : '';
                    const clickable = !future || !!injury; // будущие дни без травмы не кликабельны

                    return (
                        <button
                            key={idx}
                            className={`aspect-square flex items-center justify-center rounded-md text-[0.65rem] font-bold text-white ${bgColor} ${todayClass} ${clickable ? 'cursor-pointer hover:scale-105 hover:shadow-md active:scale-95' : 'cursor-not-allowed opacity-70'
                                }`}
                            onClick={() => clickable && onDayClick(date)}
                            disabled={!clickable}
                            title={
                                injury
                                    ? `Тип: ${injury.type}\nОписание: ${injury.description}`
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

// ----------------------------------------------------------------------
// Компонент календаря года (12 месяцев)
// ----------------------------------------------------------------------
const YearCalendar: React.FC<{
    year: number;
    injuriesYear: InjuryDto[];
    onDayClick: (date: Date) => void;
}> = ({ year, injuriesYear, onDayClick }) => {
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

// ----------------------------------------------------------------------
// Основной компонент
// ----------------------------------------------------------------------
const GreenCross: React.FC = () => {
    const { user } = useAuth();
    const isSafetyEngineer = useMemo(
        () => user?.roles?.includes('Safety') || user?.roles?.includes('Admin') || false,
        [user]
    );

    const [viewMode, setViewMode] = useState<'cross' | 'year'>('cross');
    const [currentDate, setCurrentDate] = useState(() => startOfMonth(new Date()));

    const [injuriesMonth, setInjuriesMonth] = useState<InjuryDto[]>([]);
    const [injuriesYear, setInjuriesYear] = useState<InjuryDto[]>([]);
    const [latestInjury, setLatestInjury] = useState<InjuryDto | null>(null);
    const [loading, setLoading] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedInjury, setSelectedInjury] = useState<InjuryDto | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
    const [formType, setFormType] = useState('');
    const [formDescription, setFormDescription] = useState('');

    // Реф для хранения актуальной даты (чтобы использовать в интервале)
    const currentDateRef = useRef(currentDate);
    useEffect(() => {
        currentDateRef.current = currentDate;
    }, [currentDate]);

    // Функция загрузки данных за месяц/год + последней травмы (с поддержкой фонового режима)
    const fetchData = useCallback(async (background = false) => {
        const date = currentDateRef.current;
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        // Если это не фоновое обновление, показываем спиннер
        if (!background) setLoading(true);

        try {
            const [monthData, yearData, latest] = await Promise.all([
                safetyService.getByMonth(year, month),
                safetyService.getByYear(year),
                safetyService.getLatest(), // ← загружаем последнюю травму
            ]);
            setInjuriesMonth(monthData);
            setInjuriesYear(yearData);
            setLatestInjury(latest); // ← сохраняем
        } catch (error) {
            console.error('Ошибка при обновлении данных:', error);
        } finally {
            // Скрываем спиннер только если это не фоновое обновление
            if (!background) setLoading(false);
        }
    }, []);

    // Первоначальная загрузка и загрузка при смене месяца/года
    useEffect(() => {
        fetchData(false);
    }, [currentDate, fetchData]);

    // Автоматическое обновление каждые 10 минут
    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchData(true);
        }, 600000);
        return () => clearInterval(intervalId);
    }, [fetchData]);

    // Функция для ручного обновления последней травмы (используется после мутаций)
    const refreshLatest = useCallback(async () => {
        try {
            const latest = await safetyService.getLatest();
            setLatestInjury(latest);
        } catch (error) {
            console.error('Ошибка при обновлении последней травмы', error);
        }
    }, []);

    const goPrev = useCallback(() => {
        setCurrentDate((prev) => {
            if (viewMode === 'cross') {
                const d = new Date(prev);
                d.setMonth(d.getMonth() - 1);
                return startOfMonth(d);
            } else {
                return setYear(prev, getYear(prev) - 1);
            }
        });
    }, [viewMode]);

    const goNext = useCallback(() => {
        setCurrentDate((prev) => {
            if (viewMode === 'cross') {
                const d = new Date(prev);
                d.setMonth(d.getMonth() + 1);
                return startOfMonth(d);
            } else {
                return setYear(prev, getYear(prev) + 1);
            }
        });
    }, [viewMode]);

    const monthDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(currentDate);
        return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    }, [currentDate]);

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

    const cellContent = useMemo(() => {
        const content: Record<string, { day: number; date: Date; injury?: InjuryDto }> = {};
        const daysInMonth = monthDays.length;
        const totalCells = crossCells.length;
        const cellValues: (number | null)[] = new Array(totalCells).fill(null);

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
                const injury = injuriesMonth.find((inj) => isSameDay(new Date(inj.date), date));
                content[`${cell.row}-${cell.col}`] = { day: dayNumber, date, injury };
            }
        });

        return content;
    }, [crossCells, monthDays, injuriesMonth, currentDate]);

    // Вычисление статистики (месяц, год, глобальные дни без травм)
    const stats = useMemo(() => {
        const monthInjuries = injuriesMonth.length;
        const yearInjuries = injuriesYear.length;

        // Расчёт дней без травм с даты последней глобальной травмы
        let daysWithoutInjury = 0;
        let globalLastInjuryDate: Date | null = null;

        if (latestInjury) {
            globalLastInjuryDate = new Date(latestInjury.date);
            const today = startOfDay(new Date());
            // разница в полных днях (исключая сегодняшний неполный день)
            daysWithoutInjury = differenceInCalendarDays(today, globalLastInjuryDate) - 1;
            if (daysWithoutInjury < 0) daysWithoutInjury = 0;
        } else {
            // Если травм вообще не было – можно показать 0 или прочерк.
            // Поставим 0, чтобы не смущать.
            daysWithoutInjury = 0;
        }

        return {
            monthInjuries,
            yearInjuries,
            daysWithoutInjury,
            globalLastInjuryDate,   // для отображения в подсказке
        };
    }, [injuriesMonth, injuriesYear, latestInjury]);

    const handleDateClick = useCallback((date: Date) => {
        const today = startOfDay(new Date());
        const injury = injuriesYear.find((inj) => isSameDay(new Date(inj.date), date));

        if (isFuture(date) && !injury) {
            return;
        }

        setSelectedDate(date);
        if (injury) {
            setSelectedInjury(injury);
            setFormType(injury.type);
            setFormDescription(injury.description);
            setModalMode(isSafetyEngineer ? 'edit' : 'view');
        } else {
            if (isSafetyEngineer) {
                setSelectedInjury(null);
                setFormType('');
                setFormDescription('');
                setModalMode('create');
            } else {
                return;
            }
        }
        setModalOpen(true);
    }, [injuriesYear, isSafetyEngineer]);

    const handleCellClick = (row: number, col: number) => {
        const key = `${row}-${col}`;
        const cell = cellContent[key];
        if (!cell) return;
        handleDateClick(cell.date);
    };

    // CRUD операции с последующим обновлением последней травмы
    const handleCreate = async () => {
        if (!selectedDate || !formType.trim() || !formDescription.trim()) return;
        try {
            const newInjury = await safetyService.create({
                date: format(selectedDate, 'yyyy-MM-dd'),
                type: formType,
                description: formDescription,
            });
            setInjuriesMonth((prev) => [...prev, newInjury]);
            setInjuriesYear((prev) => [...prev, newInjury]);
            await refreshLatest(); // ← обновляем последнюю травму
            setModalOpen(false);
        } catch (error) {
            console.error('Ошибка при создании травмы', error);
        }
    };

    const handleUpdate = async () => {
        if (!selectedInjury || !formType.trim() || !formDescription.trim()) return;
        try {
            const updated = await safetyService.update(selectedInjury.id, {
                type: formType,
                description: formDescription,
            });
            setInjuriesMonth((prev) =>
                prev.map((inj) => (inj.id === updated.id ? updated : inj))
            );
            setInjuriesYear((prev) =>
                prev.map((inj) => (inj.id === updated.id ? updated : inj))
            );
            await refreshLatest(); // ← обновляем (дата могла не измениться, но на всякий случай)
            setModalOpen(false);
        } catch (error) {
            console.error('Ошибка при обновлении травмы', error);
        }
    };

    const handleDelete = async () => {
        if (!selectedInjury) return;
        try {
            await safetyService.delete(selectedInjury.id);
            setInjuriesMonth((prev) => prev.filter((inj) => inj.id !== selectedInjury.id));
            setInjuriesYear((prev) => prev.filter((inj) => inj.id !== selectedInjury.id));
            await refreshLatest(); // ← обновляем (возможно, последняя травма удалена)
            setModalOpen(false);
        } catch (error) {
            console.error('Ошибка при удалении травмы', error);
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedDate(null);
        setSelectedInjury(null);
    };

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
                <div className="max-w-6xl mx-auto">
                    {/* Заголовок и навигация */}
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-500 rounded-xl shadow-lg flex items-center justify-center">
                                <span className="text-white text-2xl">✚</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                                Зелёный крест
                            </h1>
                        </div>

                        <div className="flex items-center space-x-2">
                            <div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl shadow-md p-1 mr-2">
                                <button
                                    onClick={() => setViewMode('cross')}
                                    className={`flex items-center px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${viewMode === 'cross'
                                        ? 'bg-green-500 text-white'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <FiGrid className="mr-1.5" />
                                    Крест
                                </button>
                                <button
                                    onClick={() => setViewMode('year')}
                                    className={`flex items-center px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${viewMode === 'year'
                                        ? 'bg-green-500 text-white'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <FiYearIcon className="mr-1.5" />
                                    Год
                                </button>
                            </div>

                            <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-1">
                                <button
                                    onClick={goPrev}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    aria-label="Предыдущий"
                                >
                                    <FiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                                <span className="text-lg font-semibold text-gray-700 dark:text-gray-200 min-w-[140px] text-center">
                                    {viewMode === 'cross'
                                        ? format(currentDate, 'LLLL yyyy', { locale: ru })
                                        : currentDate.getFullYear()}
                                </span>
                                <button
                                    onClick={goNext}
                                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    aria-label="Следующий"
                                >
                                    <FiChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Две колонки */}
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Левая колонка – статистика и легенда */}
                        <div className="lg:w-80 space-y-5">
                            {/* Статистика */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5">
                                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center">
                                    <FiActivity className="mr-2 text-green-500" />
                                    Статистика
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                            <FiCalendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">Травм за месяц</div>
                                            <div className="text-3xl font-bold text-gray-800 dark:text-white">
                                                {stats.monthInjuries}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                                            <FiActivity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">Травм за год</div>
                                            <div className="text-3xl font-bold text-gray-800 dark:text-white">
                                                {stats.yearInjuries}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                                            <FiClock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">Дней без травм</div>
                                            <div className="text-3xl font-bold text-gray-800 dark:text-white">
                                                {stats.daysWithoutInjury}
                                            </div>
                                            {stats.globalLastInjuryDate && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    Последняя травма: {format(stats.globalLastInjuryDate, 'dd.MM.yyyy')}
                                                </div>
                                            )}
                                            {!stats.globalLastInjuryDate && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    Травм не было
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Легенда */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5">
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Легенда</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 shadow-md"></div>
                                        <span className="text-gray-600 dark:text-gray-300">Нет травм (прошедшие и сегодня)</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-400 to-red-600 shadow-md"></div>
                                        <span className="text-gray-600 dark:text-gray-300">Есть травмы</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg bg-gray-300 dark:bg-gray-600 shadow-md"></div>
                                        <span className="text-gray-600 dark:text-gray-300">Будущие дни</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg border-2 border-blue-500 bg-transparent"></div>
                                        <span className="text-gray-600 dark:text-gray-300">Сегодня</span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        Нажмите на день, чтобы увидеть информацию о травме или добавить запись (кроме будущих дней без травм).
                                    </div>
                                </div>
                            </div>

                            {/* Информация о правах */}
                            {isSafetyEngineer && (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5">
                                    <div className="flex items-center text-green-600 dark:text-green-400">
                                        <FiPlus className="mr-2" />
                                        <span className="text-sm">Инженер по ТБ — доступно редактирование</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Правая колонка – отображение в зависимости от режима */}
                        <div className="flex-1">
                            {loading && (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
                                </div>
                            )}

                            {!loading && viewMode === 'cross' && (
                                // Сетка креста
                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 md:p-6 transition-all">
                                    <div className="grid grid-cols-7 gap-2 md:gap-3">
                                        {Array.from({ length: 7 }, (_, row) =>
                                            Array.from({ length: 7 }, (_, col) => {
                                                const key = `${row}-${col}`;
                                                const cell = cellContent[key];
                                                const isCross = crossCells.some((c) => c.row === row && c.col === col);

                                                if (!isCross) {
                                                    return <div key={key} className="aspect-square" />;
                                                }

                                                const hasInjury = cell?.injury;
                                                const dayNumber = cell?.day;
                                                const cellDate = cell?.date;

                                                const isFutureDate = cellDate ? isFuture(cellDate) : false;
                                                const isTodayDate = cellDate ? isToday(cellDate) : false;

                                                let bgColor = 'bg-gray-100 dark:bg-gray-700';
                                                if (dayNumber) {
                                                    if (isFutureDate) {
                                                        bgColor = 'bg-gray-300 dark:bg-gray-600';
                                                    } else {
                                                        bgColor = hasInjury
                                                            ? 'bg-gradient-to-br from-red-400 to-red-600 dark:from-red-600 dark:to-red-800 shadow-md shadow-red-200/50 dark:shadow-red-900/30'
                                                            : 'bg-gradient-to-br from-green-400 to-emerald-600 dark:from-green-600 dark:to-emerald-800 shadow-md shadow-green-200/50 dark:shadow-green-900/30';
                                                    }
                                                }

                                                const todayClass = isTodayDate && dayNumber ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : '';

                                                return (
                                                    <button
                                                        key={key}
                                                        className={`aspect-square flex items-center justify-center rounded-xl transition-all duration-200 ${bgColor} ${todayClass} ${dayNumber && !isFutureDate
                                                            ? 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95'
                                                            : dayNumber && isFutureDate
                                                                ? 'cursor-not-allowed opacity-70'
                                                                : 'cursor-default'
                                                            }`}
                                                        onClick={() => handleCellClick(row, col)}
                                                        title={
                                                            hasInjury
                                                                ? `Тип: ${cell!.injury!.type}\nОписание: ${cell!.injury!.description}`
                                                                : isFutureDate
                                                                    ? 'Будущий день'
                                                                    : ''
                                                        }
                                                        disabled={!dayNumber || isFutureDate}
                                                    >
                                                        {dayNumber && (
                                                            <span className="text-base md:text-lg font-bold text-white drop-shadow-md">
                                                                {dayNumber}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {!loading && viewMode === 'year' && (
                                // Календарь года с поддержкой кликов
                                <YearCalendar
                                    year={currentDate.getFullYear()}
                                    injuriesYear={injuriesYear}
                                    onDayClick={handleDateClick}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Модальное окно */}
            {modalOpen && (
                <div
                    className="fixed inset-0 bg-black/60 dark:bg-gray-900/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-opacity"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 opacity-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                                {modalMode === 'create' && 'Добавить травму'}
                                {modalMode === 'edit' && 'Редактировать травму'}
                                {modalMode === 'view' && 'Информация о травме'}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Дата
                                </label>
                                <input
                                    type="text"
                                    value={selectedDate ? format(selectedDate, 'dd.MM.yyyy') : ''}
                                    disabled
                                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Тип травмы
                                </label>
                                {modalMode === 'view' ? (
                                    <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200">
                                        {formType || '—'}
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={formType}
                                        onChange={(e) => setFormType(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        placeholder="Например, порез, ушиб"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Описание
                                </label>
                                {modalMode === 'view' ? (
                                    <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200 min-h-[80px]">
                                        {formDescription || '—'}
                                    </div>
                                ) : (
                                    <textarea
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        placeholder="Подробное описание травмы"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
                            {modalMode === 'edit' && (
                                <>
                                    <button
                                        onClick={handleDelete}
                                        className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex items-center space-x-2"
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                        <span>Удалить</span>
                                    </button>
                                    <button
                                        onClick={handleUpdate}
                                        className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
                                    >
                                        Сохранить
                                    </button>
                                </>
                            )}
                            {modalMode === 'create' && (
                                <button
                                    onClick={handleCreate}
                                    className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors flex items-center space-x-2"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    <span>Создать</span>
                                </button>
                            )}
                            {modalMode === 'view' && (
                                <button
                                    onClick={closeModal}
                                    className="px-5 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-xl transition-colors"
                                >
                                    Закрыть
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GreenCross;