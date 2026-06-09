/**
 * Основной компонент приложения "Зелёный крест".
 * Управляет режимами отображения (крест/год), навигацией, загрузкой данных,
 * отображает статистику, легенду, календарь и модальное окно для работы с травмами.
 * Также загружает и показывает название организации под заголовком.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FiGrid, FiCalendar as FiYearIcon, FiChevronLeft, FiChevronRight, FiMapPin } from 'react-icons/fi';
import { Toaster } from 'react-hot-toast';
import { useInjuryData } from '../../hooks/useInjuryData';
import { useNavigation } from '../../hooks/useNavigation';
import { useStatistics } from '../../hooks/useStatistics';
import CrossCalendar from './CrossCalendar';
import YearCalendarView from './YearCalendarView';
import StatsPanel from './StatsPanel';
import LegendPanel from './LegendPanel';
import InjuryModal from './InjuryModal';
import type { InjuryDto } from '../../types';
import { safetyService } from '../../services/api';

const GreenCross: React.FC = () => {
    // Роль: инженер по ТБ (для демонстрации – true, в реальности получается из контекста)
    const isSafetyEngineer = true;

    // Состояние для названия организации
    const [organizationName, setOrganizationName] = useState<string>('');

    // Режим отображения: 'cross' (зелёный крест) или 'year' (годовой календарь)
    const [viewMode, setViewMode] = useState<'cross' | 'year'>('cross');

    // Управление текущей датой (месяц для креста, год для годового календаря)
    const { currentDate, goPrev, goNext } = useNavigation(viewMode);

    // Загрузка данных: травмы за месяц и за год (для календарей)
    const {
        injuriesMonth,
        injuriesYear,
        loading: injuriesLoading,
        refetch: refetchInjuries,
    } = useInjuryData(currentDate);

    // Статистика по значимым травмам
    const yearNum = currentDate.getFullYear();
    const monthNum = currentDate.getMonth() + 1;
    const {
        statistics,
        loading: statisticsLoading,
        refreshStatistics,
    } = useStatistics(yearNum, monthNum);

    // Загрузка названия организации при монтировании компонента
    useEffect(() => {
        safetyService.getOrganizationName().then(name => {
            if (name) setOrganizationName(name);
        });
    }, []);

    // Состояние модального окна
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedInjury, setSelectedInjury] = useState<InjuryDto | null>(null);

    // Обработчик клика по дню (вызывается из CrossCalendar и YearCalendarView)
    const handleDateClick = useCallback(
        (date: Date) => {
            // Если день будущий и нет травмы – нельзя открыть модалку
            const injury = injuriesYear.find((inj) => {
                const injDate = new Date(inj.date);
                return (
                    injDate.getFullYear() === date.getFullYear() &&
                    injDate.getMonth() === date.getMonth() &&
                    injDate.getDate() === date.getDate()
                );
            });
            const isFuture = date > new Date() && !injury;
            if (isFuture) return;

            setSelectedDate(date);
            setSelectedInjury(injury || null);
            setModalOpen(true);
        },
        [injuriesYear]
    );

    // Закрытие модалки с последующим обновлением данных
    const handleModalClose = useCallback(() => {
        setModalOpen(false);
        setSelectedDate(null);
        setSelectedInjury(null);
        // Обновляем травмы для календарей и статистику
        refetchInjuries();
        refreshStatistics();
    }, [refetchInjuries, refreshStatistics]);

    // Общий флаг загрузки (показываем спиннер, пока загружается что-то одно)
    const loading = injuriesLoading || statisticsLoading;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Заголовок и навигация: на десктопе в строку, на мобильных колонкой, но всё по левому краю */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                    {/* Левая часть: заголовок + название организации */}
                    <div className="flex flex-col items-start">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-500 rounded-xl shadow-lg flex items-center justify-center">
                                <span className="text-white text-2xl">✚</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                                Зелёный крест
                            </h1>
                        </div>
                        {/* Название организации - всегда по левому краю */}
                        {organizationName && (
                            <div className="mt-2 sm:ml-12">
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                    <FiMapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    <span className="font-medium tracking-wide">{organizationName}</span>
                                </div>
                                <div className="mt-1.5 w-16 h-px bg-gradient-to-r from-green-400/50 to-transparent" />
                            </div>
                        )}
                    </div>

                    {/* Правая часть: переключатели и навигация - на мобильных переносится, выравнивание по левому краю */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {/* Кнопки переключения режима */}
                        <div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl shadow-md p-1">
                            <button
                                onClick={() => setViewMode('cross')}
                                className={`flex items-center px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${viewMode === 'cross'
                                        ? 'bg-green-500 text-white'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <FiGrid className="mr-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span>Крест</span>
                            </button>
                            <button
                                onClick={() => setViewMode('year')}
                                className={`flex items-center px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${viewMode === 'year'
                                        ? 'bg-green-500 text-white'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <FiYearIcon className="mr-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span>Год</span>
                            </button>
                        </div>

                        {/* Навигация по месяцам/годам */}
                        <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-1">
                            <button
                                onClick={goPrev}
                                className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label="Назад"
                            >
                                <FiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                            <span className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-200 min-w-[110px] sm:min-w-[140px] text-center">
                                {viewMode === 'cross'
                                    ? format(currentDate, 'LLLL yyyy', { locale: ru })
                                    : currentDate.getFullYear()}
                            </span>
                            <button
                                onClick={goNext}
                                className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label="Вперёд"
                            >
                                <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Две колонки: статистика/легенда + календарь */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Левая колонка */}
                    <div className="lg:w-80 space-y-5">
                        <StatsPanel statistics={statistics} />
                        <LegendPanel />
                        {isSafetyEngineer && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5">
                                <div className="flex items-center text-green-600 dark:text-green-400">
                                    <span className="text-sm">Инженер по ТБ — доступно редактирование</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Правая колонка – календарь */}
                    <div className="flex-1">
                        {loading && (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent" />
                            </div>
                        )}
                        {!loading && viewMode === 'cross' && (
                            <CrossCalendar
                                currentDate={currentDate}
                                injuriesMonth={injuriesMonth}
                                onDayClick={handleDateClick}
                            />
                        )}
                        {!loading && viewMode === 'year' && (
                            <YearCalendarView
                                year={currentDate.getFullYear()}
                                injuriesYear={injuriesYear}
                                onDayClick={handleDateClick}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Модальное окно */}
            {modalOpen && (
                <InjuryModal
                    selectedDate={selectedDate}
                    selectedInjury={selectedInjury}
                    isSafetyEngineer={isSafetyEngineer}
                    onClose={handleModalClose}
                    onInjuryChanged={() => {
                        refetchInjuries();
                        refreshStatistics();
                    }}
                />
            )}
        </div>
    );
};

export default GreenCross;