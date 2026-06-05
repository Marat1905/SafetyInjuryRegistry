/**
 * Основной компонент приложения "Зелёный крест".
 * Управляет режимами отображения (крест/год), навигацией, загрузкой данных,
 * отображает статистику, легенду, календарь и модальное окно для работы с травмами.
 */
import React, { useState, useCallback } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FiGrid, FiCalendar as FiYearIcon, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { Toaster } from 'react-hot-toast';
import { useInjuryData } from '../../hooks/useInjuryData';
import { useNavigation } from '../../hooks/useNavigation';
import CrossCalendar from './CrossCalendar';
import YearCalendarView from './YearCalendarView';
import StatsPanel from './StatsPanel';
import LegendPanel from './LegendPanel';
import InjuryModal from './InjuryModal';
import type { InjuryDto } from '../../types';

const GreenCross: React.FC = () => {
    // Роль: инженер по ТБ (для демонстрации – true, в реальности получается из контекста)
    const isSafetyEngineer = true;

    // Режим отображения: 'cross' (зелёный крест) или 'year' (годовой календарь)
    const [viewMode, setViewMode] = useState<'cross' | 'year'>('cross');

    // Управление текущей датой (месяц для креста, год для годового календаря)
    const { currentDate, goPrev, goNext } = useNavigation(viewMode);

    // Загрузка данных: травмы за месяц, за год, последняя значимая травма
    const {
        injuriesMonth,
        injuriesYear,
        latestSignificantInjury,
        loading,
        refetch,
        refreshLatestSignificant,
    } = useInjuryData(currentDate);

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
        refetch(); // обновляем данные после возможных изменений
    }, [refetch]);

    return (
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
                                <FiGrid className="mr-1.5" /> Крест
                            </button>
                            <button
                                onClick={() => setViewMode('year')}
                                className={`flex items-center px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${viewMode === 'year'
                                    ? 'bg-green-500 text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <FiYearIcon className="mr-1.5" /> Год
                            </button>
                        </div>

                        <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-1">
                            <button onClick={goPrev} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
                                <FiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                            <span className="text-lg font-semibold text-gray-700 dark:text-gray-200 min-w-[140px] text-center">
                                {viewMode === 'cross'
                                    ? format(currentDate, 'LLLL yyyy', { locale: ru })
                                    : currentDate.getFullYear()}
                            </span>
                            <button onClick={goNext} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
                                <FiChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Две колонки: статистика/легенда + календарь */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Левая колонка */}
                    <div className="lg:w-80 space-y-5">
                        <StatsPanel
                            injuriesMonth={injuriesMonth}
                            injuriesYear={injuriesYear}
                            latestSignificantInjury={latestSignificantInjury}
                        />
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
                        refetch();
                        refreshLatestSignificant();
                    }}
                />
            )}

            {/* Toaster для уведомлений (тема уже задана в App) – здесь не нужен, так как App уже предоставляет глобальный Toaster */}
        </div>
    );
};

export default GreenCross;