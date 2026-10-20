/**
 * Компактная панель программы «Ноль травм» (365 дней без П1/П2).
 *
 * Отображает только ключевую информацию: количество дней, статус, прогресс,
 * количество прикреплённых документов и дату начала или завершения периода.
 * Все действия по редактированию, загрузке файлов и удалению вынесены
 * в модальное окно ZeroInjuryModal.
 *
 * Отображаемые даты:
 *  • Активный период     → «Начало: DD.MM.YYYY» — с какого числа идёт отсчёт.
 *  • Успешно завершённый → «Завершён: DD.MM.YYYY» — каким числом закрыт период.
 *  • Прерванный травмой  → «Прерван: DD.MM.YYYY» — каким числом зафиксировано прерывание.
 *
 * Особенности:
 *  • Карточка кликабельна для ВСЕХ ролей — обычный пользователь открывает
 *    модалку в режиме просмотра и видит детали (описание, документы, историю).
 *  • Кнопки «Редактировать» и «Удалить» показываются только Safety/Admin.
 *  • Для прерванного травмой периода счётчик дней отражает длительность
 *    периода ДО прерывания (например, 4/365 если травма случилась на пятый день).
 *
 * Компонент принимает те же пропсы, что и раньше (status, history,
 * isSafetyEngineer, onChanged) — родительский GreenCrossPage менять не нужно.
 */
import React, { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    FiShield,
    FiFileText,
    FiEdit2,
    FiTrash2,
    FiCheckCircle,
    FiAlertTriangle,
    FiChevronRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import type {
    ZeroInjuryProgramDto,
    ZeroInjuryStatusDto,
} from '../../../types/greenCross';
import { safetyService } from '../../../services/greenCross/api';
import { formatDuration } from '../../../utils/greenCross/formatDuration';
import ZeroInjuryModal from './ZeroInjuryModal';

interface ZeroInjuryPanelProps {
    status: ZeroInjuryStatusDto | null;
    history: ZeroInjuryProgramDto[];
    isSafetyEngineer: boolean;
    onChanged: () => void;
}

const ZeroInjuryPanel: React.FC<ZeroInjuryPanelProps> = ({
    status,
    history,
    isSafetyEngineer,
    onChanged,
}) => {
    const [modalOpen, setModalOpen] = useState(false);

    // Пока статус не пришёл из API — показываем компактный спиннер.
    if (!status) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 flex items-center justify-center min-h-[120px]">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent" />
            </div>
        );
    }

    const current = status.currentProgram;
    const last = status.lastFinalizedProgram;

    // Определяем, какую программу показывать на панели:
    //  1) активную, если она есть;
    //  2) иначе последнюю завершённую (успешно или с прерыванием);
    //  3) иначе ничего.
    const program: ZeroInjuryProgramDto | null = current ?? last ?? null;

    // ------------------------------------------------------------------
    // Быстрое удаление последнего завершённого периода (Safety/Admin).
    // Останавливаем propagation, чтобы клик по корзине не открывал модалку.
    // ------------------------------------------------------------------
    const handleQuickDelete = async (
        e: React.MouseEvent,
        p: ZeroInjuryProgramDto
    ) => {
        e.stopPropagation();

        const label = p.isSuccessfullyCompleted
            ? 'успешно завершённый период'
            : 'период, прерванный травмой';

        const confirmed = window.confirm(
            `Удалить ${label}?\n\n` +
            `Период: ${format(new Date(p.startDate), 'dd.MM.yyyy')}` +
            (p.completedAt
                ? ` — ${format(new Date(p.completedAt), 'dd.MM.yyyy')}`
                : '') +
            `\nДлительность: ${formatDuration(p.daysPassed)}\n\n` +
            `Это действие необратимо.`
        );
        if (!confirmed) return;

        try {
            await safetyService.deleteZeroInjuryProgram(p.id);
            toast.success('Период удалён');
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

    // ------------------------------------------------------------------
    // Открытие модалки из клика по кнопкам действий (Safety/Admin).
    // stopPropagation, чтобы не сработал общий onClick по карточке.
    // ------------------------------------------------------------------
    const handleOpenFromAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        setModalOpen(true);
    };

    // ------------------------------------------------------------------
    // Пустое состояние: программы ещё не было.
    // ------------------------------------------------------------------
    if (!program) {
        return (
            <>
                <div
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500 transition-colors cursor-pointer group"
                    onClick={isSafetyEngineer ? () => setModalOpen(true) : undefined}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && isSafetyEngineer) {
                            e.preventDefault();
                            setModalOpen(true);
                        }
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FiShield className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                Ноль травм
                            </span>
                        </div>
                        {isSafetyEngineer && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                Запустить
                            </span>
                        )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {isSafetyEngineer
                            ? 'Программа не запущена. Нажмите, чтобы установить дату начала.'
                            : 'Программа «365 дней без травм» не запущена.'}
                    </div>
                </div>

                {modalOpen && (
                    <ZeroInjuryModal
                        status={status}
                        history={history}
                        isSafetyEngineer={isSafetyEngineer}
                        onClose={() => setModalOpen(false)}
                        onChanged={onChanged}
                    />
                )}
            </>
        );
    }

    // ------------------------------------------------------------------
    // Определяем визуальные параметры в зависимости от статуса программы.
    // ------------------------------------------------------------------
    const isCompleted = program.status === 'Completed';
    const isInterrupted = program.status === 'Interrupted';

    // Прогресс в процентах от целевого периода.
    const progressPercent = Math.min(
        100,
        Math.round((program.daysPassed / (program.targetDays || 365)) * 100)
    );

    // Цвета и иконки статуса.
    let statusColor = 'text-blue-600 dark:text-blue-400';
    let bgGradient = 'from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800';
    let StatusIcon: React.ReactNode = (
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
    );
    let statusText = 'Период активен';
    let progressBarColor = 'bg-blue-500';

    // Текст строки с датой. Формируется отдельно для каждого статуса:
    //  • Активный      → «Начало: DD.MM.YYYY»;
    //  • Завершённый   → «Завершён: DD.MM.YYYY»;
    //  • Прерванный    → «Прерван: DD.MM.YYYY».
    // Для активного периода всегда используем startDate. Для завершённого и
    // прерванного — completedAt (которое на бэкенде содержит либо плановую дату
    // успешного финиша, либо дату прерывающей травмы).
    let dateLabel: string | null = null;
    let dateValue: string | null = null;
    let dateColor = 'text-gray-500 dark:text-gray-400';

    if (isCompleted) {
        statusColor = 'text-green-600 dark:text-green-400';
        bgGradient = 'from-green-50 to-white dark:from-green-900/20 dark:to-gray-800';
        StatusIcon = <FiCheckCircle className="w-4 h-4 text-green-500" />;
        statusText = 'Период завершён успешно';
        progressBarColor = 'bg-green-500';
        dateLabel = 'Завершён';
        dateValue = program.completedAt
            ? format(new Date(program.completedAt), 'dd.MM.yyyy', { locale: ru })
            : null;
        dateColor = 'text-green-600/80 dark:text-green-400/70';
    } else if (isInterrupted) {
        statusColor = 'text-red-600 dark:text-red-400';
        bgGradient = 'from-red-50 to-white dark:from-red-900/20 dark:to-gray-800';
        StatusIcon = <FiAlertTriangle className="w-4 h-4 text-red-500" />;
        statusText = 'Период прерван травмой';
        progressBarColor = 'bg-red-500';
        dateLabel = 'Прерван';
        dateValue = program.completedAt
            ? format(new Date(program.completedAt), 'dd.MM.yyyy', { locale: ru })
            : null;
        dateColor = 'text-red-600/80 dark:text-red-400/70';
    } else {
        // Активный период — показываем дату начала отсчёта.
        dateLabel = 'Начало';
        dateValue = format(new Date(program.startDate), 'dd.MM.yyyy', { locale: ru });
        dateColor = 'text-gray-500 dark:text-gray-400';
    }

    // ------------------------------------------------------------------
    // Карточка активной / завершённой / прерванной программы.
    // ------------------------------------------------------------------
    return (
        <>
            <div
                className={`bg-gradient-to-br ${bgGradient} rounded-2xl shadow-lg p-4 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 cursor-pointer group relative`}
                onClick={() => setModalOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setModalOpen(true);
                    }
                }}
                aria-label="Открыть детали программы «Ноль травм»"
                title="Открыть детали программы «Ноль травм»"
            >
                {/* Заголовок и кнопки действий (Safety/Admin). */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <FiShield className={`w-5 h-5 ${statusColor}`} />
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            Ноль травм
                        </span>
                    </div>

                    {isSafetyEngineer ? (
                        <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Кнопка редактирования: открывает модалку. */}
                            <button
                                type="button"
                                onClick={handleOpenFromAction}
                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                                title={
                                    current
                                        ? 'Редактировать / Начать новый период'
                                        : 'Начать новый период'
                                }
                            >
                                <FiEdit2 className="w-4 h-4" />
                            </button>

                            {/* Кнопка удаления: только для завершённых периодов. */}
                            {program.isCompleted && (
                                <button
                                    type="button"
                                    onClick={(e) => handleQuickDelete(e, program)}
                                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    title="Удалить период"
                                >
                                    <FiTrash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ) : (
                        // Для обычных пользователей — шеврон как подсказка «открывается».
                        <FiChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors" />
                    )}
                </div>

                {/* Основной счётчик дней. */}
                <div className="flex items-baseline gap-2 mb-2">
                    <span className={`text-4xl font-extrabold ${statusColor}`}>
                        {program.daysPassed}
                    </span>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        / {program.targetDays} дн.
                    </span>
                </div>

                {/* Прогресс-бар. */}
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${progressBarColor}`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Статус и индикатор документов. */}
                <div className="flex items-center justify-between text-xs">
                    <div className={`flex items-center gap-1.5 font-medium ${statusColor}`}>
                        {StatusIcon}
                        <span>{statusText}</span>
                    </div>

                    {program.documents && program.documents.length > 0 && (
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 px-2 py-0.5 rounded-full">
                            <FiFileText className="w-3 h-3" />
                            <span>{program.documents.length}</span>
                        </div>
                    )}
                </div>

                {/* Строка с датой: начало для активного, завершение/прерывание — для остальных. */}
                {dateValue && (
                    <div className={`mt-1.5 text-[11px] font-medium ${dateColor}`}>
                        {dateLabel}: {dateValue}
                    </div>
                )}

                {/* Для прерванного периода — отдельная строка с длительностью до прерывания. */}
                {isInterrupted && (
                    <div className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
                        Период длился {formatDuration(program.daysPassed)} до прерывания
                    </div>
                )}

                {/* Подсказка при наведении для обычных пользователей. */}
                {!isSafetyEngineer && (
                    <div className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-800/80 px-3 py-1 rounded-full shadow-sm">
                            Подробнее
                        </span>
                    </div>
                )}
            </div>

            {modalOpen && (
                <ZeroInjuryModal
                    status={status}
                    history={history}
                    isSafetyEngineer={isSafetyEngineer}
                    onClose={() => setModalOpen(false)}
                    onChanged={onChanged}
                />
            )}
        </>
    );
};

export default React.memo(ZeroInjuryPanel);