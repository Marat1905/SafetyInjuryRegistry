/**
 * Основной компонент приложения "Зелёный крест".
 * Управляет режимами отображения (крест/год), навигацией, загрузкой данных,
 * отображает статистику, легенду, календарь и модальное окно для работы с травмами.
 * Также загружает и показывает название организации под заголовком.
 *
 * Роль пользователя берётся из AuthContext (в тестовом режиме —
 * переключается кнопкой в правом верхнем углу экрана).
 *
 * Создание / редактирование / удаление травм доступно только
 * администратору и инженеру по ТБ. Обычный пользователь может
 * только просматривать уже существующие травмы.
 *
 * Бейджи роли и версии бэкенда передаются в CrossCalendar как слоты
 * bottomLeftSlot / bottomRightSlot — они рендерятся прямо в пустых
 * нижних углах креста (см. CrossCalendar.tsx).
 */
import React, { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    FiGrid,
    FiCalendar as FiYearIcon,
    FiChevronLeft,
    FiChevronRight,
    FiMapPin,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
    CrossCalendar,
    InjuryModal,
    LegendPanel,
    StatsPanel,
    YearCalendarView,
    ZeroInjuryPanel,
} from '../../components/greenCross';
import {
    useInjuryData,
    useNavigation,
    useStatistics,
    useBackendVersion,
    useZeroInjuryProgram,
} from '../../hooks/greenCross';
import type { InjuryDto } from '../../types/greenCross';
import { safetyService } from '../../services/greenCross/api';
import { useAuth } from '../../context/AuthContext';

const GreenCross: React.FC = () => {
    // Роль: инженер по ТБ (или админ) — приходит из AuthContext.
    // В тестовом режиме переключается кнопкой в правом верхнем углу.
    // testRole — строковое имя текущей тестовой роли ('User' | 'Safety' | 'Admin'),
    // нужно для наглядного логирования.
    const { isAdminOrSafety, testRole } = useAuth();
    const isSafetyEngineer = isAdminOrSafety;

    // Версия бэкенда (null, пока не загружена)
    const version = useBackendVersion();

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

    // Программа «Ноль травм»: статус и история
    const {
        status: zeroInjuryStatus,
        history: zeroInjuryHistory,
        refresh: refreshZeroInjury,
    } = useZeroInjuryProgram();

    // Загрузка названия организации при монтировании компонента
    useEffect(() => {
        safetyService.getOrganizationName().then(name => {
            if (name) setOrganizationName(name);
        });
    }, []);

    // Состояние модального окна для травм
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedInjury, setSelectedInjury] = useState<InjuryDto | null>(null);

    // Обработчик клика по дню (вызывается из CrossCalendar и YearCalendarView)
    const handleDateClick = useCallback(
        (date: Date) => {
            // Ищем травму в этот день среди загруженных за год
            const injury = injuriesYear.find((inj) => {
                const injDate = new Date(inj.date);
                return (
                    injDate.getFullYear() === date.getFullYear() &&
                    injDate.getMonth() === date.getMonth() &&
                    injDate.getDate() === date.getDate()
                );
            });

            // Если день будущий и травмы нет – нельзя открыть модалку
            const isFuture = date > new Date() && !injury;
            if (isFuture) return;

            // Если травмы в этот день нет и пользователь не имеет прав
            // на создание/редактирование – просто показываем тост и выходим.
            // Модальное окно НЕ открываем.
            if (!injury && !isSafetyEngineer) {
                toast('В этот день нет травмы', {
                    icon: 'ℹ️',
                });
                return;
            }

            setSelectedDate(date);
            setSelectedInjury(injury || null);
            setModalOpen(true);
        },
        [injuriesYear, isSafetyEngineer, testRole]
    );

    // Закрытие модалки с последующим обновлением данных
    const handleModalClose = useCallback(() => {
        setModalOpen(false);
        setSelectedDate(null);
        setSelectedInjury(null);
        // Обновляем травмы для календарей и статистику
        refetchInjuries();
        refreshStatistics();
        // Если была добавлена значимая травма, панель «Ноль травм» тоже обновится.
        refreshZeroInjury();
    }, [refetchInjuries, refreshStatistics, refreshZeroInjury]);

    // Общий флаг загрузки (показываем спиннер, пока загружается что-то одно)
    const loading = injuriesLoading || statisticsLoading;

    return (
        <div className="w-full">
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
                {/* Левая колонка — только информационные панели и легенда. */}
                <div className="lg:w-80 space-y-5 shrink-0">
                    <ZeroInjuryPanel
                        status={zeroInjuryStatus}
                        history={zeroInjuryHistory}
                        isSafetyEngineer={isSafetyEngineer}
                        onChanged={() => {
                            refreshZeroInjury();
                            refreshStatistics();
                        }}
                    />

                    <StatsPanel statistics={statistics} />
                    <LegendPanel />
                </div>

                {/* Правая колонка – календарь.
                    Бейджи роли и версии передаются прямо в CrossCalendar,
                    который рендерит их в пустых нижних углах креста.
                    Класс min-w-0 предотвращает вылезание календаря за пределы экрана. */}
                <div className="flex-1 min-w-0">
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
                            bottomLeftSlot={
                                isSafetyEngineer ? (
                                    <div
                                        className="px-2 py-1.5 rounded-xl bg-green-50/90 dark:bg-green-900/30 border border-green-200 dark:border-green-800 backdrop-blur-sm"
                                        title="Инженер по ТБ — доступно редактирование"
                                    >
                                        <div className="text-[10px] leading-tight font-semibold text-green-700 dark:text-green-400">
                                            Инженер ТБ
                                        </div>
                                        <div className="text-[9px] leading-tight text-green-600/80 dark:text-green-400/70">
                                            редактирование доступно
                                        </div>
                                    </div>
                                ) : null
                            }
                            bottomRightSlot={
                                version ? (
                                    <div
                                        className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm text-[10px] sm:text-[11px] font-mono text-gray-500 dark:text-gray-400 border border-gray-200/60 dark:border-gray-700/60"
                                        title={`Версия бэкенда: ${version}`}
                                    >
                                        <svg
                                            className="w-3 h-3 text-green-500/70 dark:text-green-400/70"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                                            />
                                        </svg>
                                        <span>v{version}</span>
                                    </div>
                                ) : null
                            }
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

            {/* Модальное окно травмы */}
            {modalOpen && (
                <InjuryModal
                    selectedDate={selectedDate}
                    selectedInjury={selectedInjury}
                    isSafetyEngineer={isSafetyEngineer}
                    onClose={handleModalClose}
                    onInjuryChanged={() => {
                        refetchInjuries();
                        refreshStatistics();
                        refreshZeroInjury();
                    }}
                />
            )}
        </div>
    );
};

export default GreenCross;