import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    format,
    getDaysInMonth,
    setDate,
    startOfMonth,
    differenceInCalendarDays,
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
    FiPaperclip,
    FiUpload,
    FiFile,
    FiImage,
    FiFileText,
} from 'react-icons/fi';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { safetyService } from '../services/api';
import type { InjuryDto } from '../types/index';
import InjuryFilesManager from '../components/InjuryFilesManager';
// Импорт схем валидации из отдельного файла
import { createInjurySchema, updateInjurySchema, type CreateInjuryFormData, type UpdateInjuryFormData } from '../schemas/validationSchemas';

// ----------------------------------------------------------------------
// Вспомогательные функции для работы с категориями
// ----------------------------------------------------------------------
const isSignificantCategory = (category: string): boolean => {
    const sig = ['Fatality', 'LostWorkdayCase', 'П1', 'П2'];
    return sig.includes(category);
};

const getCategoryColorClass = (category: string, hasInjury: boolean): string => {
    if (!hasInjury) return 'bg-gradient-to-br from-green-400 to-emerald-600 dark:from-green-600 dark:to-emerald-800';
    if (isSignificantCategory(category)) {
        return 'bg-gradient-to-br from-red-400 to-red-600 dark:from-red-600 dark:to-red-800 shadow-md shadow-red-200/50 dark:shadow-red-900/30';
    }
    return 'bg-gradient-to-br from-yellow-400 to-amber-600 dark:from-yellow-600 dark:to-amber-800 shadow-md shadow-yellow-200/50 dark:shadow-yellow-900/30';
};

// ----------------------------------------------------------------------
// Компонент отображения одного месяца в годовом календаре
// ----------------------------------------------------------------------
const MonthView: React.FC<{
    year: number;
    monthIndex: number;
    injuriesYear: InjuryDto[];
    onDayClick: (date: Date) => void;
}> = ({ year, monthIndex, injuriesYear, onDayClick }) => {
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const daysInMonth = getDaysInMonth(firstDayOfMonth);
    const startWeekDay = getDay(firstDayOfMonth);
    const offset = startWeekDay === 0 ? 6 : startWeekDay - 1;

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
                            className={`aspect-square flex items-center justify-center rounded-md text-[0.65rem] font-bold text-white ${bgColor} ${todayClass} ${clickable ? 'cursor-pointer hover:scale-105 hover:shadow-md active:scale-95' : 'cursor-not-allowed opacity-70'}`}
                            onClick={() => clickable && onDayClick(date)}
                            disabled={!clickable}
                            title={injury ? `Тип: ${injury.type}\nКатегория: ${injury.category}\nОписание: ${injury.description}` : future ? 'Будущий день' : 'Нет травмы'}
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
// Годовой календарь
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
// Менеджер файлов при создании травмы (без изменений)
// ----------------------------------------------------------------------
interface PendingFile {
    id: string;
    file: File;
    description: string;
}

const PendingFilesManager: React.FC<{
    pendingFiles: PendingFile[];
    onAddFiles: (files: File[]) => void;
    onRemoveFile: (id: string) => void;
    onUpdateDescription: (id: string, description: string) => void;
}> = ({ pendingFiles, onAddFiles, onRemoveFile, onUpdateDescription }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            onAddFiles(Array.from(e.target.files));
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length) onAddFiles(Array.from(files));
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    };

    const getFileIcon = (contentType: string) => {
        if (contentType.startsWith('image/')) return <FiImage className="w-5 h-5 text-blue-500" />;
        if (contentType === 'application/pdf') return <FiFileText className="w-5 h-5 text-red-500" />;
        return <FiFile className="w-5 h-5 text-gray-500" />;
    };

    return (
        <div className="space-y-4">
            {/* Drag & Drop область */}
            <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer
                    ${isDragging
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                    }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <div className="flex flex-col items-center justify-center py-6 px-4">
                    <FiUpload className={`w-8 h-8 mb-2 ${isDragging ? 'text-green-500' : 'text-gray-400'}`} />
                    <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                        {isDragging ? 'Отпустите файлы для загрузки' : 'Перетащите файлы сюда или кликните для выбора'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        JPEG, PNG, PDF до 10 МБ (можно несколько)
                    </p>
                </div>
            </div>

            {/* Список выбранных файлов */}
            {pendingFiles.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {pendingFiles.map((item) => (
                        <div key={item.id} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    {getFileIcon(item.file.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                            {item.file.name}
                                        </span>
                                        <span className="text-xs text-gray-500">{formatFileSize(item.file.size)}</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => onUpdateDescription(item.id, e.target.value)}
                                        placeholder="Описание (необязательно)"
                                        className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-1 focus:ring-green-500"
                                    />
                                </div>
                                <button
                                    onClick={() => onRemoveFile(item.id)}
                                    className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                    title="Удалить"
                                >
                                    <FiX className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------------------------
// Основной компонент GreenCross
// ----------------------------------------------------------------------
const GreenCross: React.FC = () => {
    const isSafetyEngineer = false;

    const [viewMode, setViewMode] = useState<'cross' | 'year'>('cross');
    const [currentDate, setCurrentDate] = useState(() => startOfMonth(new Date()));

    const [injuriesMonth, setInjuriesMonth] = useState<InjuryDto[]>([]);
    const [injuriesYear, setInjuriesYear] = useState<InjuryDto[]>([]);
    const [latestSignificantInjury, setLatestSignificantInjury] = useState<InjuryDto | null>(null);
    const [loading, setLoading] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedInjury, setSelectedInjury] = useState<InjuryDto | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [creating, setCreating] = useState(false);

    // Реактивные формы с использованием импортированных схем
    const {
        control: createControl,
        handleSubmit: handleCreateSubmit,
        reset: resetCreateForm,
        formState: { errors: createErrors, isSubmitting: createSubmitting },
    } = useForm<CreateInjuryFormData>({
        resolver: zodResolver(createInjurySchema),
        defaultValues: { type: '', description: '', category: '' },
    });

    const {
        control: updateControl,
        handleSubmit: handleUpdateSubmit,
        reset: resetUpdateForm,
        formState: { errors: updateErrors, isSubmitting: updateSubmitting },
    } = useForm<UpdateInjuryFormData>({
        resolver: zodResolver(updateInjurySchema),
        defaultValues: { type: '', description: '', category: '' },
    });

    const currentDateRef = useRef(currentDate);
    useEffect(() => {
        currentDateRef.current = currentDate;
    }, [currentDate]);

    // ------------------------------------------------------------------
    // Загрузка данных (травмы за месяц/год + последняя значимая травма)
    // ------------------------------------------------------------------
    const fetchData = useCallback(async (background = false) => {
        const date = currentDateRef.current;
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        if (!background) setLoading(true);
        try {
            const [monthData, yearData, latestSig] = await Promise.all([
                safetyService.getByMonth(year, month),
                safetyService.getByYear(year),
                safetyService.getLatestSignificant(),
            ]);
            setInjuriesMonth(monthData);
            setInjuriesYear(yearData);
            setLatestSignificantInjury(latestSig);
        } catch (error) {
            console.error('Ошибка при обновлении данных:', error);
            toast.error('Не удалось загрузить данные');
        } finally {
            if (!background) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(false);
    }, [currentDate, fetchData]);

    useEffect(() => {
        const intervalId = setInterval(() => fetchData(true), 600000);
        return () => clearInterval(intervalId);
    }, [fetchData]);

    // Обновление только последней значимой травмы
    const refreshLatestSignificant = useCallback(async () => {
        try {
            const latest = await safetyService.getLatestSignificant();
            setLatestSignificantInjury(latest);
        } catch (error) {
            console.error('Ошибка при обновлении последней значимой травмы', error);
        }
    }, []);

    // ------------------------------------------------------------------
    // Навигация
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // Статистика (только П1 и П2)
    // ------------------------------------------------------------------
    const stats = useMemo(() => {
        // Травмы П1/П2 за месяц
        const monthSignificant = injuriesMonth.filter(inj => isSignificantCategory(inj.category));
        const yearSignificant = injuriesYear.filter(inj => isSignificantCategory(inj.category));

        let daysWithoutInjury = 0;
        if (latestSignificantInjury) {
            const lastDate = new Date(latestSignificantInjury.date);
            const today = startOfDay(new Date());
            daysWithoutInjury = differenceInCalendarDays(today, lastDate) - 1;
            if (daysWithoutInjury < 0) daysWithoutInjury = 0;
        }
        return {
            monthInjuries: monthSignificant.length,
            yearInjuries: yearSignificant.length,
            daysWithoutInjury,
            lastSignificantDate: latestSignificantInjury ? new Date(latestSignificantInjury.date) : null,
        };
    }, [injuriesMonth, injuriesYear, latestSignificantInjury]);

    // ------------------------------------------------------------------
    // Построение сетки для креста (7x7)
    // ------------------------------------------------------------------
    const monthDays = useMemo(() => {
        return Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => i + 1);
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

    // ------------------------------------------------------------------
    // Обработчики кликов
    // ------------------------------------------------------------------
    const handleDateClick = useCallback((date: Date) => {
        const injury = injuriesYear.find((inj) => isSameDay(new Date(inj.date), date));
        if (isFuture(date) && !injury) return;

        setSelectedDate(date);
        if (injury) {
            setSelectedInjury(injury);
            // Заполняем формы редактирования
            resetUpdateForm({
                type: injury.type,
                description: injury.description,
                category: injury.category,
            });
            setModalMode(isSafetyEngineer ? 'edit' : 'view');
            setPendingFiles([]);
        } else {
            if (isSafetyEngineer) {
                setSelectedInjury(null);
                // Сбрасываем форму создания
                resetCreateForm({ type: '', description: '', category: '' });
                setModalMode('create');
                setPendingFiles([]);
            } else {
                return;
            }
        }
        setModalOpen(true);
    }, [injuriesYear, isSafetyEngineer, resetCreateForm, resetUpdateForm]);

    const handleCellClick = (row: number, col: number) => {
        const key = `${row}-${col}`;
        const cell = cellContent[key];
        if (cell) handleDateClick(cell.date);
    };

    // ------------------------------------------------------------------
    // Управление файлами при создании
    // ------------------------------------------------------------------
    const addPendingFiles = (files: File[]) => {
        const newFiles: PendingFile[] = files.map((file) => ({
            id: `${Date.now()}-${Math.random()}-${file.name}`,
            file,
            description: '',
        }));
        setPendingFiles((prev) => [...prev, ...newFiles]);
    };

    const removePendingFile = (id: string) => {
        setPendingFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const updatePendingFileDescription = (id: string, description: string) => {
        setPendingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, description } : f)));
    };

    // ------------------------------------------------------------------
    // Категории для выпадающего списка
    // ------------------------------------------------------------------
    const categoryOptions = [
        { value: "Fatality", label: "П1 - Смертельный случай" },
        { value: "LostWorkdayCase", label: "П2 - Травма с потерей трудоспособности" },
        { value: "FirstAidCase", label: "П3 - Микротравма" },
        { value: "AccidentOrNearMiss", label: "П4 - Авария / Near Miss" },
        { value: "PreventedIncident", label: "П5 - Предотвращенное происшествие" },
        { value: "ThirdPartyInjury", label: "П6 - Травма третьего лица" }
    ];

    // ------------------------------------------------------------------
    // CRUD операции с тостами
    // ------------------------------------------------------------------
    const onCreate = async (data: CreateInjuryFormData) => {
        if (!selectedDate) {
            toast.error('Дата не выбрана');
            return;
        }
        setCreating(true);
        try {
            // Создаём травму
            const newInjury = await safetyService.create({
                date: format(selectedDate, 'yyyy-MM-dd'),
                type: data.type,
                description: data.description,
                category: data.category,
            });

            // Обновляем локальные состояния
            setInjuriesMonth((prev) => [...prev, newInjury]);
            setInjuriesYear((prev) => [...prev, newInjury]);
            await refreshLatestSignificant();

            // Загружаем файлы, если они есть
            if (pendingFiles.length > 0) {
                const uploadPromises = pendingFiles.map(async (pending) => {
                    try {
                        await safetyService.uploadFile(
                            newInjury.id,
                            pending.file,
                            pending.description.trim() || undefined
                        );
                        toast.success(`Файл "${pending.file.name}" загружен`);
                    } catch (err) {
                        console.error(`Ошибка загрузки файла ${pending.file.name}:`, err);
                        toast.error(`Ошибка загрузки файла "${pending.file.name}"`);
                    }
                });
                await Promise.allSettled(uploadPromises);
            }

            toast.success('Запись о травме успешно создана');
            setModalOpen(false);
            setPendingFiles([]);
        } catch (error) {
            console.error('Ошибка при создании травмы', error);
            toast.error('Не удалось создать травму');
        } finally {
            setCreating(false);
        }
    };

    const onUpdate = async (data: UpdateInjuryFormData) => {
        if (!selectedInjury) return;
        try {
            const updated = await safetyService.update(selectedInjury.id, {
                type: data.type ?? selectedInjury.type,
                description: data.description ?? selectedInjury.description,
                category: data.category !== selectedInjury.category ? data.category : undefined,
            });
            setInjuriesMonth((prev) => prev.map((inj) => (inj.id === updated.id ? updated : inj)));
            setInjuriesYear((prev) => prev.map((inj) => (inj.id === updated.id ? updated : inj)));
            await refreshLatestSignificant();
            toast.success('Запись о травме обновлена');
            setModalOpen(false);
        } catch (error) {
            console.error('Ошибка при обновлении травмы', error);
            toast.error('Не удалось обновить травму');
        }
    };

    const handleDelete = async () => {
        if (!selectedInjury) return;
        if (!confirm('Вы уверены, что хотите удалить эту травму? Это действие необратимо.')) return;
        try {
            await safetyService.delete(selectedInjury.id);
            setInjuriesMonth((prev) => prev.filter((inj) => inj.id !== selectedInjury.id));
            setInjuriesYear((prev) => prev.filter((inj) => inj.id !== selectedInjury.id));
            await refreshLatestSignificant();
            toast.success('Запись о травме удалена');
            setModalOpen(false);
        } catch (error) {
            console.error('Ошибка при удалении травмы', error);
            toast.error('Не удалось удалить травму');
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedDate(null);
        setSelectedInjury(null);
        setPendingFiles([]);
        resetCreateForm();
        resetUpdateForm();
    };

    // ------------------------------------------------------------------
    // Рендер
    // ------------------------------------------------------------------
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
                                    className={`flex items-center px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${viewMode === 'cross' ? 'bg-green-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                    <FiGrid className="mr-1.5" /> Крест
                                </button>
                                <button
                                    onClick={() => setViewMode('year')}
                                    className={`flex items-center px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${viewMode === 'year' ? 'bg-green-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                    <FiYearIcon className="mr-1.5" /> Год
                                </button>
                            </div>
                            <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-1">
                                <button onClick={goPrev} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <FiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                                <span className="text-lg font-semibold text-gray-700 dark:text-gray-200 min-w-[140px] text-center">
                                    {viewMode === 'cross' ? format(currentDate, 'LLLL yyyy', { locale: ru }) : currentDate.getFullYear()}
                                </span>
                                <button onClick={goNext} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <FiChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Две колонки */}
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Левая колонка – статистика и легенда */}
                        <div className="lg:w-80 space-y-5">
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

                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5">
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Легенда</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 shadow-md" />
                                        <span className="text-gray-600 dark:text-gray-300">Нет травм (прошедшие и сегодня)</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-400 to-red-600 shadow-md" />
                                        <span className="text-gray-600 dark:text-gray-300">Травмы П1 или П2</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 shadow-md" />
                                        <span className="text-gray-600 dark:text-gray-300">Травмы П3–П6</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg bg-gray-300 dark:bg-gray-600 shadow-md" />
                                        <span className="text-gray-600 dark:text-gray-300">Будущие дни</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded-lg border-2 border-blue-500 bg-transparent" />
                                        <span className="text-gray-600 dark:text-gray-300">Сегодня</span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        Нажмите на день, чтобы увидеть информацию о травме или добавить запись (кроме будущих дней без травм).
                                    </div>
                                </div>
                            </div>

                            {isSafetyEngineer && (
                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5">
                                    <div className="flex items-center text-green-600 dark:text-green-400">
                                        <FiPlus className="mr-2" />
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
                                                    if (isFutureDate) bgColor = 'bg-gray-300 dark:bg-gray-600';
                                                    else if (injury) bgColor = getCategoryColorClass(injury.category, true);
                                                    else bgColor = 'bg-gradient-to-br from-green-400 to-emerald-600 dark:from-green-600 dark:to-emerald-800 shadow-md shadow-green-200/50 dark:shadow-green-900/30';
                                                }
                                                const todayClass = isTodayDate && dayNumber ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : '';

                                                return (
                                                    <button
                                                        key={key}
                                                        className={`aspect-square flex items-center justify-center rounded-xl transition-all duration-200 ${bgColor} ${todayClass} ${dayNumber && !isFutureDate ? 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95' : dayNumber && isFutureDate ? 'cursor-not-allowed opacity-70' : 'cursor-default'}`}
                                                        onClick={() => handleCellClick(row, col)}
                                                        title={injury ? `Тип: ${injury.type}\nКатегория: ${injury.category}\nОписание: ${injury.description}` : isFutureDate ? 'Будущий день' : ''}
                                                        disabled={!dayNumber || isFutureDate}
                                                    >
                                                        {dayNumber && <span className="text-base md:text-lg font-bold text-white drop-shadow-md">{dayNumber}</span>}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                            {!loading && viewMode === 'year' && (
                                <YearCalendar year={currentDate.getFullYear()} injuriesYear={injuriesYear} onDayClick={handleDateClick} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* МОДАЛЬНОЕ ОКНО */}
            {modalOpen && (
                <div
                    className="fixed inset-0 bg-black/60 dark:bg-gray-900/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-opacity"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Заголовок — фиксированная верхняя часть */}
                        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
                            <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                                {modalMode === 'create' && <FiPlus className="text-green-500" />}
                                {modalMode === 'edit' && <FiActivity className="text-blue-500" />}
                                {modalMode === 'view' && <FiPaperclip className="text-gray-500" />}
                                {modalMode === 'create' && 'Добавить травму'}
                                {modalMode === 'edit' && 'Редактировать травму'}
                                {modalMode === 'view' && 'Информация о травме'}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Содержимое — зависит от режима */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {modalMode === 'view' ? (
                                // --------------------------------------------------------------
                                // РЕЖИМ ПРОСМОТРА (view): вертикальное расположение, файлы внизу
                                // --------------------------------------------------------------
                                <div className="space-y-5">
                                    {/* Дата */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата</label>
                                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200">
                                            {selectedDate ? format(selectedDate, 'dd.MM.yyyy') : ''}
                                        </div>
                                    </div>
                                    {/* Категория */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Категория происшествия</label>
                                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200">
                                            {selectedInjury ? categoryOptions.find(opt => opt.value === selectedInjury.category)?.label || selectedInjury.category : '—'}
                                        </div>
                                    </div>
                                    {/* Тип травмы */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Тип происшествия</label>
                                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200">
                                            {selectedInjury?.type || '—'}
                                        </div>
                                    </div>
                                    {/* Описание (увеличенная высота) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200 min-h-[160px] whitespace-pre-wrap">
                                            {selectedInjury?.description || '—'}
                                        </div>
                                    </div>
                                    {/* Файлы – внизу, на всю ширину */}
                                    <div>
                                        <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                                            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                <FiPaperclip className="w-4 h-4" /> Прикреплённые документы
                                            </h4>
                                            {selectedInjury ? (
                                                <InjuryFilesManager
                                                    injuryId={selectedInjury.id}
                                                    isEditable={false} // в режиме просмотра редактирование файлов недоступно
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // --------------------------------------------------------------
                                // РЕЖИМЫ СОЗДАНИЯ И РЕДАКТИРОВАНИЯ (create/edit): две колонки с react-hook-form
                                // --------------------------------------------------------------
                                <form onSubmit={modalMode === 'create' ? handleCreateSubmit(onCreate) : handleUpdateSubmit(onUpdate)}>
                                    <div className="flex flex-col md:flex-row gap-6">
                                        {/* Левая колонка: информация о травме */}
                                        <div className="md:w-1/2 space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата</label>
                                                <input
                                                    type="text"
                                                    value={selectedDate ? format(selectedDate, 'dd.MM.yyyy') : ''}
                                                    disabled
                                                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200"
                                                />
                                            </div>

                                            {/* Поле Категория */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Категория происшествия *</label>
                                                <Controller
                                                    name="category"
                                                    control={(modalMode === 'create' ? createControl : updateControl) as any}
                                                    render={({ field }) => (
                                                        <select
                                                            {...field}
                                                            className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${(modalMode === 'create' ? createErrors.category : updateErrors.category)
                                                                    ? 'border-red-500 dark:border-red-500'
                                                                    : 'border-gray-300 dark:border-gray-600'
                                                                }`}
                                                        >
                                                            <option value="">-- Выберите категорию --</option>
                                                            {categoryOptions.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                />
                                                {(modalMode === 'create' ? createErrors.category : updateErrors.category) && (
                                                    <p className="mt-1 text-xs text-red-500">
                                                        {(modalMode === 'create' ? createErrors.category : updateErrors.category)?.message}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Поле Тип происшествия */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Тип происшествия</label>
                                                <Controller
                                                    name="type"
                                                    control={(modalMode === 'create' ? createControl : updateControl) as any}
                                                    render={({ field }) => (
                                                        <input
                                                            {...field}
                                                            type="text"
                                                            placeholder="Например, порез, ушиб"
                                                            className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${(modalMode === 'create' ? createErrors.type : updateErrors.type)
                                                                    ? 'border-red-500 dark:border-red-500'
                                                                    : 'border-gray-300 dark:border-gray-600'
                                                                }`}
                                                        />
                                                    )}
                                                />
                                                {(modalMode === 'create' ? createErrors.type : updateErrors.type) && (
                                                    <p className="mt-1 text-xs text-red-500">
                                                        {(modalMode === 'create' ? createErrors.type : updateErrors.type)?.message}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Поле Описание */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                                                <Controller
                                                    name="description"
                                                    control={(modalMode === 'create' ? createControl : updateControl) as any}
                                                    render={({ field }) => (
                                                        <textarea
                                                            {...field}
                                                            rows={8}
                                                            placeholder="Подробное описание травмы (до 1000 символов)"
                                                            className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${(modalMode === 'create' ? createErrors.description : updateErrors.description)
                                                                    ? 'border-red-500 dark:border-red-500'
                                                                    : 'border-gray-300 dark:border-gray-600'
                                                                }`}
                                                        />
                                                    )}
                                                />
                                                {(modalMode === 'create' ? createErrors.description : updateErrors.description) && (
                                                    <p className="mt-1 text-xs text-red-500">
                                                        {(modalMode === 'create' ? createErrors.description : updateErrors.description)?.message}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Правая колонка: файлы */}
                                        <div className="md:w-1/2">
                                            <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                                                <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    <FiPaperclip className="w-4 h-4" /> Прикреплённые документы
                                                </h4>
                                                {modalMode === 'create' ? (
                                                    <PendingFilesManager
                                                        pendingFiles={pendingFiles}
                                                        onAddFiles={addPendingFiles}
                                                        onRemoveFile={removePendingFile}
                                                        onUpdateDescription={updatePendingFileDescription}
                                                    />
                                                ) : selectedInjury && (
                                                    <InjuryFilesManager
                                                        injuryId={selectedInjury.id}
                                                        isEditable={true}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Кнопки действий */}
                                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        {modalMode === 'edit' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={handleDelete}
                                                    className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex items-center space-x-2"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                    <span>Удалить</span>
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={updateSubmitting}
                                                    className="px-5 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl transition-colors"
                                                >
                                                    {updateSubmitting ? 'Сохранение...' : 'Сохранить'}
                                                </button>
                                            </>
                                        )}
                                        {modalMode === 'create' && (
                                            <button
                                                type="submit"
                                                disabled={createSubmitting || creating}
                                                className="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-xl transition-colors flex items-center space-x-2"
                                            >
                                                {(createSubmitting || creating) && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
                                                <FiPlus className="w-4 h-4" />
                                                <span>{(createSubmitting || creating) ? 'Создание...' : 'Создать'}</span>
                                            </button>
                                        )}
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GreenCross;