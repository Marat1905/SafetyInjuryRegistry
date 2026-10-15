/**
 * Модальное окно управления программой «Ноль травм».
 *
 * Состоит из двух вкладок:
 *  • «Период» — текущая активная программа или последняя завершённая.
 *    Здесь же отображается форма создания (если программы ещё не было)
 *    и форма редактирования активной программы.
 *  • «История» — все завершённые периоды (успешно завершённые и прерванные
 *    травмой). Для Safety/Admin доступны удаление и переход к просмотру.
 *
 * Общие элементы:
 *  • Кнопка «Начать новый период» — сверху, видна только на вкладке «Период».
 *    Активна, когда нет активной программы и у пользователя есть права.
 *  • Кнопка «X» — закрытие модалки.
 *
 * Режимы формы (mode):
 *  • 'create' — создание новой программы;
 *  • 'edit'   — редактирование активной программы;
 *  • 'view'   — просмотр активной или завершённой программы.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    FiX,
    FiPlus,
    FiTrash2,
    FiCheckCircle,
    FiAlertTriangle,
    FiClock,
    FiEdit3,
    FiList,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
    createZeroInjuryProgramSchema,
    updateZeroInjuryProgramSchema,
} from '../../../schemas/greenCross';
import { safetyService } from '../../../services/greenCross/api';
import type {
    ZeroInjuryProgramDto,
    ZeroInjuryStatusDto,
} from '../../../types/greenCross';
import { formatDuration, formatDurationShort } from '../../../utils/greenCross/formatDuration';
import ZeroInjuryDocumentsManager from './ZeroInjuryDocumentsManager';
import { DatePicker } from '../../common';

interface ZeroInjuryModalProps {
    status: ZeroInjuryStatusDto;
    history: ZeroInjuryProgramDto[];
    isSafetyEngineer: boolean;
    onClose: () => void;
    onChanged: () => void;
}

type ModalMode = 'view' | 'create' | 'edit';
type ModalTab = 'period' | 'history';

const ZeroInjuryModal: React.FC<ZeroInjuryModalProps> = ({
    status,
    history,
    isSafetyEngineer,
    onClose,
    onChanged,
}) => {
    // Исходный режим:
    //  - если есть активная программа — 'edit' (или 'view' для обычного пользователя);
    //  - если активной нет, но есть завершённая — 'view';
    //  - если вообще ничего нет — 'create' (для Safety/Admin) или 'view'.
    const initialMode: ModalMode = useMemo(() => {
        if (status.currentProgram) {
            return isSafetyEngineer ? 'edit' : 'view';
        }
        if (status.lastFinalizedProgram) {
            return 'view';
        }
        return isSafetyEngineer ? 'create' : 'view';
    }, [status, isSafetyEngineer]);

    const [mode, setMode] = useState<ModalMode>(initialMode);
    const [tab, setTab] = useState<ModalTab>('period');
    const [submitting, setSubmitting] = useState(false);
    // Программа, которая сейчас редактируется или просматривается на вкладке «Период».
    const [editingProgram, setEditingProgram] = useState<ZeroInjuryProgramDto | null>(
        status.currentProgram
    );

    // Флаг: пользователь уже нажал «Начать новый период» и находится в форме создания.
    // Не даём фоновым обновлениям статуса сбросить режим обратно.
    const userStartedNewRef = useRef(false);

    useEffect(() => {
        if (userStartedNewRef.current) return;
        setMode(initialMode);
        setEditingProgram(status.currentProgram);
    }, [initialMode, status.currentProgram]);

    // ------------------------------------------------------------------
    // Форма создания
    // ------------------------------------------------------------------
    const createForm = useForm({
        resolver: zodResolver(createZeroInjuryProgramSchema),
        defaultValues: {
            startDate: status.nextAllowedStartDate
                ? format(new Date(status.nextAllowedStartDate), 'yyyy-MM-dd')
                : format(new Date(), 'yyyy-MM-dd'),
            description: '',
            targetDays: 365,
        },
    });

    // ------------------------------------------------------------------
    // Форма редактирования
    // ------------------------------------------------------------------
    const editForm = useForm({
        resolver: zodResolver(updateZeroInjuryProgramSchema),
        defaultValues: {
            startDate: editingProgram
                ? format(new Date(editingProgram.startDate), 'yyyy-MM-dd')
                : undefined,
            description: editingProgram?.description ?? '',
            targetDays: editingProgram?.targetDays ?? 365,
        },
    });

    useEffect(() => {
        if (editingProgram) {
            editForm.reset({
                startDate: format(new Date(editingProgram.startDate), 'yyyy-MM-dd'),
                description: editingProgram.description,
                targetDays: editingProgram.targetDays,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingProgram?.id]);

    // ------------------------------------------------------------------
    // Обработчики
    // ------------------------------------------------------------------
    const handleCreate = async (data: {
        startDate: string;
        description: string;
        targetDays: number;
    }) => {
        setSubmitting(true);
        try {
            await safetyService.createZeroInjuryProgram({
                startDate: data.startDate,
                description: data.description,
                targetDays: data.targetDays,
            });
            toast.success('Программа «Ноль травм» успешно запущена');
            userStartedNewRef.current = false;
            onChanged();
            onClose();
        } catch (err: any) {
            console.error(err);
            const message =
                err?.response?.data?.error ||
                err?.response?.data?.title ||
                'Не удалось создать программу';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async (data: {
        startDate?: string;
        description?: string;
        targetDays?: number;
    }) => {
        if (!editingProgram) return;
        setSubmitting(true);
        try {
            const payload: any = {};
            if (data.startDate) payload.startDate = data.startDate;
            if (data.description) payload.description = data.description;
            if (typeof data.targetDays === 'number') payload.targetDays = data.targetDays;

            await safetyService.updateZeroInjuryProgram(editingProgram.id, payload);
            toast.success('Программа обновлена');
            onChanged();
            onClose();
        } catch (err: any) {
            console.error(err);
            const message =
                err?.response?.data?.error ||
                err?.response?.data?.title ||
                'Не удалось обновить программу';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    /**
     * Удаление программы «Ноль травм» вместе со всеми прикреплёнными документами.
     * Доступно только Safety/Admin. Работает как для активной программы,
     * так и для любого завершённого периода из истории.
     */
    const handleDelete = async (program: ZeroInjuryProgramDto) => {
        const docsCount = program.documents?.length ?? 0;
        const label = program.isSuccessfullyCompleted
            ? 'успешно завершённый период'
            : program.isCompleted
                ? 'период, прерванный травмой'
                : 'активную программу';

        const confirmed = window.confirm(
            `Удалить ${label}?\n\n` +
            `Период: ${format(new Date(program.startDate), 'dd.MM.yyyy')}` +
            (program.completedAt
                ? ` — ${format(new Date(program.completedAt), 'dd.MM.yyyy')}`
                : '') +
            `\nДлительность: ${formatDuration(program.daysPassed)}\n` +
            `Прикреплённых документов: ${docsCount}\n\n` +
            `Это действие необратимо.`
        );
        if (!confirmed) return;

        try {
            await safetyService.deleteZeroInjuryProgram(program.id);
            toast.success('Период удалён');

            // Если удалили тот, что сейчас открыт в форме/просмотре — закрываем модалку.
            if (editingProgram?.id === program.id) {
                onChanged();
                onClose();
                return;
            }
            onChanged();
        } catch (err: any) {
            console.error(err);
            const message =
                err?.response?.data?.error ||
                err?.response?.data?.title ||
                'Не удалось удалить период';
            toast.error(message);
        }
    };

    // Переключение на создание новой программы.
    const handleStartNew = () => {
        if (!isSafetyEngineer) {
            toast.error('Недостаточно прав');
            return;
        }
        if (!status.canStartNew) {
            toast.error('Нельзя начать новую программу, пока предыдущая не завершена');
            return;
        }
        createForm.reset({
            startDate: status.nextAllowedStartDate
                ? format(new Date(status.nextAllowedStartDate), 'yyyy-MM-dd')
                : format(new Date(), 'yyyy-MM-dd'),
            description: '',
            targetDays: 365,
        });
        userStartedNewRef.current = true;
        setMode('create');
        setEditingProgram(null);
        // Автоматически переключаемся на вкладку «Период», чтобы пользователь
        // сразу увидел форму создания (если он был на «Истории»).
        setTab('period');
    };

    // Просмотр конкретной программы из истории.
    const handleOpenFromHistory = (program: ZeroInjuryProgramDto) => {
        userStartedNewRef.current = false;
        setEditingProgram(program);
        // В режиме просмотра — всегда view, если пользователь не Safety/Admin.
        // Safety/Admin тоже открывают view из истории (редактировать завершённую нельзя).
        setMode('view');
        setTab('period');
    };

    // ------------------------------------------------------------------
    // Бейдж статуса (используется в шапке и истории).
    // ------------------------------------------------------------------
    const renderStatusBadge = (program: ZeroInjuryProgramDto) => {
        if (program.status === 'Completed') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium">
                    <FiCheckCircle className="w-3 h-3" /> Успешно завершена
                </span>
            );
        }
        if (program.status === 'Interrupted') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium">
                    <FiAlertTriangle className="w-3 h-3" /> Прервана травмой
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                <FiClock className="w-3 h-3" /> Активна
            </span>
        );
    };

    // ------------------------------------------------------------------
    // Форма создания/редактирования (вкладка «Период»).
    // ------------------------------------------------------------------
    const renderForm = () => {
        const isCreate = mode === 'create';
        const form = isCreate ? createForm : editForm;
        const onSubmit = isCreate ? handleCreate : handleUpdate;
        const submitLabel = isCreate ? 'Создать' : 'Сохранить изменения';

        return (
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-5">
                {/* Дата начала */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Дата начала периода *
                    </label>
                    <Controller
                        name="startDate"
                        control={form.control as any}
                        render={({ field }) => (
                            <DatePicker
                                date={field.value ? new Date(field.value) : new Date()}
                                onChange={(d) => field.onChange(format(d, 'yyyy-MM-dd'))}
                                minDate={
                                    status.nextAllowedStartDate
                                        ? new Date(status.nextAllowedStartDate)
                                        : undefined
                                }
                                maxDate={new Date()}
                            />
                        )}
                    />
                    {(form.formState.errors as any).startDate && (
                        <p className="mt-1 text-xs text-red-500">
                            {(form.formState.errors as any).startDate.message as string}
                        </p>
                    )}
                    {status.nextAllowedStartDate && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Минимальная дата:{' '}
                            {format(new Date(status.nextAllowedStartDate), 'dd.MM.yyyy')}
                            {status.lastSignificantInjuryDate && (
                                <>
                                    {' '}
                                    (последняя значимая травма:{' '}
                                    {format(new Date(status.lastSignificantInjuryDate), 'dd.MM.yyyy')})
                                </>
                            )}
                        </p>
                    )}
                </div>

                {/* Описание */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Описание / основание *
                    </label>
                    <Controller
                        name="description"
                        control={form.control as any}
                        render={({ field }) => (
                            <textarea
                                {...field}
                                rows={4}
                                placeholder="Например: приказ №238 от 30.09.2026"
                                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${(form.formState.errors as any).description
                                        ? 'border-red-500 dark:border-red-500'
                                        : 'border-gray-300 dark:border-gray-600'
                                    }`}
                            />
                        )}
                    />
                    {(form.formState.errors as any).description && (
                        <p className="mt-1 text-xs text-red-500">
                            {(form.formState.errors as any).description.message as string}
                        </p>
                    )}
                </div>

                {/* Целевой период */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Целевой период (дней)
                    </label>
                    <Controller
                        name="targetDays"
                        control={form.control as any}
                        render={({ field }) => (
                            <input
                                type="number"
                                value={field.value ?? 365}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                min={1}
                                max={3650}
                                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${(form.formState.errors as any).targetDays
                                        ? 'border-red-500 dark:border-red-500'
                                        : 'border-gray-300 dark:border-gray-600'
                                    }`}
                            />
                        )}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Завершение периода будет отмечено системой автоматически при достижении
                        этого количества дней.
                    </p>
                </div>

                {/* Документы — только для редактирования уже созданной программы */}
                {!isCreate && editingProgram && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                            Прикреплённые документы
                        </h4>
                        <ZeroInjuryDocumentsManager
                            programId={editingProgram.id}
                            isEditable={true}
                        />
                    </div>
                )}

                {/* Кнопки */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div>
                        {mode === 'edit' && editingProgram && (
                            <button
                                type="button"
                                onClick={() => handleDelete(editingProgram)}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex items-center space-x-2"
                            >
                                <FiTrash2 className="w-4 h-4" />
                                <span>Удалить программу</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        {mode === 'create' && status.lastFinalizedProgram && (
                            <button
                                type="button"
                                onClick={() => {
                                    userStartedNewRef.current = false;
                                    setMode('view');
                                    setEditingProgram(null);
                                }}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-colors"
                            >
                                Назад
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-xl transition-colors flex items-center space-x-2"
                        >
                            {submitting && (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            )}
                            <FiPlus className="w-4 h-4" />
                            <span>{submitting ? 'Сохранение...' : submitLabel}</span>
                        </button>
                    </div>
                </div>
            </form>
        );
    };

    // ------------------------------------------------------------------
    // Просмотр активной/завершённой программы (вкладка «Период»).
    // ------------------------------------------------------------------
    const renderView = () => {
        const program = editingProgram ?? status.currentProgram ?? status.lastFinalizedProgram;
        if (!program) {
            if (isSafetyEngineer) return renderForm();
            return (
                <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                    Программа «Ноль травм» не запущена.
                </div>
            );
        }

        const isInterrupted = program.status === 'Interrupted';
        const isCompleted = program.status === 'Completed';
        const isActive = program.status === 'Active';

        const headerLabel = isActive
            ? 'Прошло'
            : isInterrupted
                ? 'Длительность'
                : 'Период';

        const missingToTarget = Math.max(0, program.targetDays - program.daysPassed);

        return (
            <div className="space-y-5">
                {/* Верхняя строка: большая цифра + статус */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <div className="text-3xl font-bold text-gray-800 dark:text-white">
                            {program.daysPassed}{' '}
                            <span className="text-xl text-gray-500 dark:text-gray-400 font-medium">
                                / {program.targetDays} дн.
                            </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {headerLabel}. Начало: {format(new Date(program.startDate), 'dd.MM.yyyy')}
                        </div>
                    </div>
                    {renderStatusBadge(program)}
                </div>

                {/* Плашка для прерванного периода */}
                {isInterrupted && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-3">
                            <FiAlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="text-base font-semibold text-red-700 dark:text-red-300">
                                    Период длился {formatDuration(program.daysPassed)} до прерывания
                                </div>
                                {program.completedAt && (
                                    <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                                        Прервано значимой травмой (П1/П2) —{' '}
                                        {format(new Date(program.completedAt), 'dd.MM.yyyy')}.
                                        {' '}Целевой период {program.targetDays} дней не был достигнут.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Плашка для успешного завершения */}
                {isCompleted && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="flex items-start gap-3">
                            <FiCheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="text-base font-semibold text-green-700 dark:text-green-300">
                                    Период пройден полностью — {formatDuration(program.daysPassed)}
                                </div>
                                {program.completedAt && (
                                    <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                                        Успешно завершён {format(new Date(program.completedAt), 'dd.MM.yyyy')}.
                                        {' '}Значимых травм (П1/П2) за период не зафиксировано.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Описание / основание */}
                <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        Описание / основание
                    </h4>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {program.description || '—'}
                    </p>
                </div>

                {/* Карточки метрик */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {isActive ? 'Прошло дней' : 'Длительность периода'}
                        </div>
                        <div className="text-lg font-semibold text-gray-800 dark:text-white">
                            {program.daysPassed}
                        </div>
                        {isInterrupted && (
                            <div className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">
                                до прерывания
                            </div>
                        )}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {isInterrupted
                                ? 'Не хватило до цели'
                                : isCompleted
                                    ? 'Цель достигнута'
                                    : 'Осталось дней'}
                        </div>
                        <div className="text-lg font-semibold text-gray-800 dark:text-white">
                            {isInterrupted
                                ? missingToTarget
                                : isCompleted
                                    ? '✓'
                                    : program.daysRemaining}
                        </div>
                        {isInterrupted && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                из {program.targetDays} дн.
                            </div>
                        )}
                    </div>
                    {program.completedAt && (
                        <div className="col-span-2 bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {isInterrupted ? 'Дата прерывания' : 'Дата завершения'}
                            </div>
                            <div className="text-lg font-semibold text-gray-800 dark:text-white">
                                {format(new Date(program.completedAt), 'dd.MM.yyyy')}
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400">
                    Установил: {program.setByUserName || '—'}
                </div>

                {/* Документы */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                        Прикреплённые документы
                    </h4>
                    <ZeroInjuryDocumentsManager
                        programId={program.id}
                        isEditable={false}
                    />
                </div>

                {/* Нижняя панель */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div>
                        {isSafetyEngineer && program.isCompleted && (
                            <button
                                type="button"
                                onClick={() => handleDelete(program)}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex items-center space-x-2"
                                title="Удалить завершённый период вместе с документами"
                            >
                                <FiTrash2 className="w-4 h-4" />
                                <span>Удалить период</span>
                            </button>
                        )}
                    </div>
                    <div className="ml-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ------------------------------------------------------------------
    // Вкладка «История» — все завершённые периоды.
    // ------------------------------------------------------------------
    const renderHistoryTab = () => {
        // Берём из общей истории только завершённые программы,
        // сортируем от новых к старым (по дате начала).
        const finalized = [...history]
            .filter((p) => p.isCompleted)
            .sort(
                (a, b) =>
                    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
            );

        if (finalized.length === 0) {
            return (
                <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                    <FiList className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <div className="text-sm">История периодов пуста</div>
                    <div className="text-xs mt-1">
                        Завершённые и прерванные периоды появятся здесь автоматически.
                    </div>
                </div>
            );
        }

        // Считаем сводную статистику для заголовка вкладки.
        const completedCount = finalized.filter((p) => p.isSuccessfullyCompleted).length;
        const interruptedCount = finalized.length - completedCount;

        return (
            <div className="space-y-4">
                {/* Сводка по истории */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Всего периодов
                        </div>
                        <div className="text-xl font-semibold text-gray-800 dark:text-white">
                            {finalized.length}
                        </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
                        <div className="text-xs text-green-700 dark:text-green-400">
                            Успешных
                        </div>
                        <div className="text-xl font-semibold text-green-700 dark:text-green-300">
                            {completedCount}
                        </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                        <div className="text-xs text-red-700 dark:text-red-400">
                            Прерванных
                        </div>
                        <div className="text-xl font-semibold text-red-700 dark:text-red-300">
                            {interruptedCount}
                        </div>
                    </div>
                </div>

                {/* Список периодов */}
                <div className="space-y-2">
                    {finalized.map((p) => {
                        const interrupted = p.status === 'Interrupted';
                        const completed = p.status === 'Completed';
                        return (
                            <div
                                key={p.id}
                                className="flex items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow"
                            >
                                {/* Клик по левой части открывает программу на вкладке «Период» */}
                                <button
                                    type="button"
                                    onClick={() => handleOpenFromHistory(p)}
                                    className="min-w-0 flex-1 text-left"
                                    title="Открыть детали периода"
                                >
                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                        {format(new Date(p.startDate), 'dd.MM.yyyy')}
                                        {p.completedAt && (
                                            <>
                                                {' '}
                                                — {format(new Date(p.completedAt), 'dd.MM.yyyy')}
                                            </>
                                        )}
                                        {' '}
                                        <span
                                            className={`inline-block ml-1 text-xs ${interrupted
                                                    ? 'text-red-500 dark:text-red-400'
                                                    : 'text-green-600 dark:text-green-400'
                                                }`}
                                        >
                                            ({formatDurationShort(p.daysPassed)})
                                        </span>
                                    </div>
                                    <div
                                        className="text-xs text-gray-500 dark:text-gray-400 truncate"
                                        title={p.description}
                                    >
                                        {p.description || '—'}
                                    </div>
                                    {interrupted && (
                                        <div className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">
                                            Длительность до прерывания: {formatDuration(p.daysPassed)}
                                        </div>
                                    )}
                                    {completed && (
                                        <div className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                                            Период пройден полностью: {formatDuration(p.daysPassed)}
                                        </div>
                                    )}
                                </button>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {renderStatusBadge(p)}
                                    {isSafetyEngineer && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(p)}
                                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                                            title="Удалить период"
                                        >
                                            <FiTrash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ------------------------------------------------------------------
    // Заголовок модалки в зависимости от режима/вкладки.
    // ------------------------------------------------------------------
    const getTitle = () => {
        if (tab === 'history') return 'История периодов';
        if (mode === 'create') return 'Новая программа «Ноль травм»';
        if (mode === 'edit') return 'Настройки программы «Ноль травм»';
        return 'Программа «Ноль травм»';
    };

    const getIcon = () => {
        if (tab === 'history') return <FiList className="text-blue-500" />;
        if (mode === 'create') return <FiPlus className="text-green-500" />;
        if (mode === 'edit') return <FiEdit3 className="text-blue-500" />;
        return <FiCheckCircle className="text-green-500" />;
    };

    // Счётчик завершённых периодов для бейджа на вкладке «История».
    const finalizedCount = history.filter((p) => p.isCompleted).length;

    // ------------------------------------------------------------------
    // Рендер
    // ------------------------------------------------------------------
    return (
        <div
            className="fixed inset-0 bg-black/60 dark:bg-gray-900/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Заголовок */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        {getIcon()} {getTitle()}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        aria-label="Закрыть"
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Вкладки */}
                <div className="px-5 pt-4">
                    <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => setTab('period')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${tab === 'period'
                                    ? 'border-green-500 text-green-600 dark:text-green-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            <FiEdit3 className="w-4 h-4" />
                            Период
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('history')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${tab === 'history'
                                    ? 'border-green-500 text-green-600 dark:text-green-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            <FiList className="w-4 h-4" />
                            История
                            {finalizedCount > 0 && (
                                <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
                                    {finalizedCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Кнопка «Начать новый период» — только на вкладке «Период» и не в режиме create */}
                {tab === 'period' && mode !== 'create' && (
                    <div className="px-5 pt-4">
                        <button
                            type="button"
                            onClick={handleStartNew}
                            disabled={!isSafetyEngineer || !status.canStartNew}
                            title={
                                !status.canStartNew
                                    ? 'Дождитесь завершения текущего периода'
                                    : !isSafetyEngineer
                                        ? 'Недостаточно прав'
                                        : 'Начать новый период'
                            }
                            className={`w-full py-2.5 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${isSafetyEngineer && status.canStartNew
                                    ? 'border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <FiEdit3 className="w-4 h-4" />
                            <span>Начать новый период</span>
                        </button>
                    </div>
                )}

                {/* Содержимое активной вкладки */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {tab === 'period' && (
                        <>
                            {(mode === 'create' || mode === 'edit') && renderForm()}
                            {mode === 'view' && renderView()}
                        </>
                    )}
                    {tab === 'history' && renderHistoryTab()}
                </div>
            </div>
        </div>
    );
};

export default ZeroInjuryModal;