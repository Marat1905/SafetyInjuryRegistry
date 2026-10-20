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
 * Кнопка «Начать новый период» отображается ТОЛЬКО для Safety/Admin
 * и только на вкладке «Период». Для обычных пользователей её нет в DOM
 * вовсе — это осознанное решение: не показывать действие, которое всё
 * равно недоступно, чтобы не создавать визуального шума.
 *
 * Режимы формы (mode):
 *  • 'create' — создание новой программы;
 *  • 'edit'   — редактирование активной программы;
 *  • 'view'   — просмотр активной или завершённой программы.
 *
 * В режиме СОЗДАНИЯ появилась секция «Прикреплённые документы» на базе
 * PendingZeroInjuryDocumentsManager. Пользователь может прикрепить приказы,
 * распоряжения, акты и т.п. ещё до того, как программа создана. После
 * успешного POST /zero-injury программа получает id, и handleCreate
 * последовательно загружает документы с РЕАЛЬНЫМ прогрессом (через
 * onUploadProgress axios). Пользователь видит полосы прогресса прямо
 * в модалке — она не закрывается до завершения загрузки.
 *
 * В режиме РЕДАКТИРОВАНИЯ документы, добавленные через
 * ZeroInjuryDocumentsManager, загружаются автоматически при нажатии
 * кнопки «Сохранить изменения» — для этого компонент держит ref на
 * ZeroInjuryDocumentsManager и вызывает его императивный метод
 * uploadPending() после успешного обновления программы. Ровно так же
 * это сделано для InjuryFilesManager в режиме редактирования травмы.
 * Отдельная кнопка «Загрузить все» в этом режиме скрыта
 * (hideUploadAllButton={true}), вместо неё показывается подсказка
 * «Документы будут загружены при сохранении программы».
 *
 * Тост о результате показывается ПОСЛЕ загрузки документов и различает
 * три исхода:
 *   • документов не было — «Программа успешно запущена/обновлена»;
 *   • все документы загружены — «…, документы загружены»;
 *   • часть не загрузилась — «…, но N из M документов не удалось
 *     загрузить». Программа при этом уже сохранена, поэтому
 *     onChanged() и finalizeClose() вызываются в любом случае.
 *
 * Два способа закрытия модалки (такой же паттерн, как в InjuryModal):
 *
 *  • handleClose() — обычное, пользовательское закрытие. Проверяет, не
 *    идёт ли сейчас создание/обновление (submitting), и если идёт —
 *    игнорирует вызов. Используется во всех точках пользовательского
 *    закрытия: кнопка X, клик по backdrop, кнопки «Отмена» и «Закрыть».
 *
 *  • finalizeClose() — принудительное закрытие. Не проверяет никаких
 *    условий, сбрасывает pending-документы и их состояния загрузки,
 *    и вызывает onClose(). Используется ТОЛЬКО из обработчиков успеха
 *    (handleCreate, handleUpdate, handleDelete), где операция уже
 *    завершена.
 *

 * Backdrop.
 *
 * Backdrop проверяет через ref + contains(): модалка закрывается только
 * если клик пришёл вне <div ref={modalRef}>. Это defense-in-depth:
 * даже если всплытие события случится (например, из-за синхронного
 * window.confirm где-то в глубине), модалка не закроется, пока клик
 * был внутри неё. Дополнительно handleClose блокируется, пока
 * submitting === true.
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
import type {
    ZeroInjuryDocumentsManagerHandle,
    UploadZeroInjuryPendingResult,
} from './ZeroInjuryDocumentsManager';
import PendingZeroInjuryDocumentsManager from './PendingZeroInjuryDocumentsManager';
import type {
    PendingDocument,
    PendingDocumentUploadState,
} from './PendingZeroInjuryDocumentsManager';
import { DatePicker } from '../../common';

// ----------------------------------------------------------------------
// Константы валидации файлов в режиме создания (должны совпадать
// с бэкендом UploadZeroInjuryDocumentFormValidator и с константами
// внутри PendingZeroInjuryDocumentsManager).
// ----------------------------------------------------------------------
const MAX_DOC_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_DOC_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

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

    // Состояния для pending-документов в режиме создания.
    // pendingDocuments — что пользователь выбрал (файл, тип, описание);
    // pendingDocumentUploadStates — карта id → { status, progress, error },
    // заполняется handleCreate по мере загрузки.
    const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
    const [pendingDocumentUploadStates, setPendingDocumentUploadStates] = useState<
        Map<string, PendingDocumentUploadState>
    >(new Map());

    // Ref на менеджер документов в режиме редактирования. Через него
    // handleUpdate запускает загрузку отложенных документов по кнопке
    // «Сохранить изменения».
    const docsManagerRef = useRef<ZeroInjuryDocumentsManagerHandle>(null);

    // Флаг: пользователь уже нажал «Начать новый период» и находится в форме создания.
    // Не даём фоновым обновлениям статуса сбросить режим обратно.
    const userStartedNewRef = useRef(false);

    // Ref на внутренний контейнер модалки. Используется backdrop-обработчиком,
    // чтобы понять, был ли клик внутри модалки или вне её.
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (userStartedNewRef.current) return;
        setMode(initialMode);
        setEditingProgram(status.currentProgram);
    }, [initialMode, status.currentProgram]);

    /**
     * Обычное, пользовательское закрытие модалки.
     *
     * Используется во всех точках, где пользователь явно закрывает
     * модалку: кнопка X в шапке, клик по backdrop, кнопки «Отмена»
     * и «Закрыть».
     *
     * Если прямо сейчас идёт создание/обновление программы
     * (submitting === true), вызов игнорируется: закрывать модалку
     * во время загрузки документов нельзя, иначе пользователь
     * потеряет прогресс, а промисы продолжат обновлять состояние
     * уже размонтированного компонента.
     *
     * ВАЖНО: НЕ используется для программного закрытия после успешной
     * операции. Для этого есть finalizeClose(). Разделение ролей
     * устраняет зависимость от «старого замыкания» и делает поведение
     * предсказуемым.
     */
    const handleClose = () => {
        if (submitting) return;
        finalizeClose();
    };

    /**
     * Принудительное закрытие модалки.
     *
     * Вызывается ТОЛЬКО из обработчиков успеха (handleCreate,
     * handleUpdate, handleDelete), где операция уже завершена и
     * никакие проверки не нужны. Сбрасывает pending-состояния,
     * чтобы при повторном открытии модалки не было «фантомных»
     * документов и статусов загрузки.
     *
     * Название «finalize» подчёркивает, что это финальный шаг операции,
     * а не пользовательское действие.
     */
    const finalizeClose = () => {
        setPendingDocuments([]);
        setPendingDocumentUploadStates(new Map());
        onClose();
    };

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
    // Работа с pending-документами (режим создания)
    // ------------------------------------------------------------------

    /**
     * Валидирует и добавляет файлы в очередь pending-документов.
     * Валидация повторяет бэкенд: размер до 20 МБ и MIME-тип из
     * разрешённого списка. Тип документа по умолчанию — 'Other',
     * пользователь может изменить его в UI.
     */
    const addPendingDocuments = (files: File[]) => {
        const validFiles: File[] = [];
        for (const file of files) {
            if (file.size > MAX_DOC_FILE_SIZE) {
                toast.error(`Файл "${file.name}" превышает 20 МБ`);
                continue;
            }
            if (!ALLOWED_DOC_MIME_TYPES.includes(file.type.toLowerCase())) {
                toast.error(
                    `Тип файла "${file.name}" не поддерживается. Разрешены: JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX`
                );
                continue;
            }
            validFiles.push(file);
        }
        if (validFiles.length === 0) return;

        const newDocs: PendingDocument[] = validFiles.map((file) => ({
            id: `${Date.now()}-${Math.random()}-${file.name}`,
            file,
            description: '',
            documentType: 'Other',
        }));
        setPendingDocuments((prev) => [...prev, ...newDocs]);
        toast.success(`Добавлено документов: ${validFiles.length}`);
    };

    const removePendingDocument = (id: string) => {
        setPendingDocuments((prev) => prev.filter((d) => d.id !== id));
        toast('Документ удалён из очереди', { icon: '🗑️' });
    };

    const updatePendingDocumentDescription = (id: string, description: string) => {
        setPendingDocuments((prev) =>
            prev.map((d) => (d.id === id ? { ...d, description } : d))
        );
    };

    const updatePendingDocumentType = (id: string, documentType: string) => {
        setPendingDocuments((prev) =>
            prev.map((d) => (d.id === id ? { ...d, documentType } : d))
        );
    };

    // ------------------------------------------------------------------
    // Обработчики
    // ------------------------------------------------------------------

    /**
     * Создание программы с опциональной загрузкой документов.
     *
     * 1) POST /zero-injury — создаёт программу.
     * 2) Если есть pending-документы — загружаем их последовательно
     *    с реальным прогрессом через safetyService.uploadZeroInjuryDocument
     *    (onProgress → setPendingDocumentUploadStates).
     * 3) Показываем итоговый тост с учётом количества неудачных загрузок.
     * 4) Небольшая пауза (0.5–1.5 сек), чтобы пользователь увидел
     *    финальное состояние прогресс-баров, затем закрываем модалку
     *    через finalizeClose().
     *
     * Закрытие через finalizeClose(), а не через handleClose(): на
     * этот момент submitting === true (мы всё ещё внутри try), и
     * handleClose() проигнорировал бы вызов. finalizeClose() закрывает
     * принудительно, потому что операция уже успешно завершена.
     */
    const handleCreate = async (data: {
        startDate: string;
        description: string;
        targetDays: number;
    }) => {
        setSubmitting(true);
        try {
            const created = await safetyService.createZeroInjuryProgram({
                startDate: data.startDate,
                description: data.description,
                targetDays: data.targetDays,
            });

            const total = pendingDocuments.length;
            let failed = 0;

            if (total > 0) {
                // Инициализируем состояния: все документы — 'uploading',
                // progress 0. Сразу видно, что процесс пошёл.
                const initial = new Map<string, PendingDocumentUploadState>();
                for (const doc of pendingDocuments) {
                    initial.set(doc.id, { status: 'uploading', progress: 0 });
                }
                setPendingDocumentUploadStates(initial);

                // Загружаем последовательно, чтобы не создавать пиковую
                // нагрузку на сервер и не запутаться в обновлениях Map.
                for (const pending of pendingDocuments) {
                    try {
                        await safetyService.uploadZeroInjuryDocument(
                            created.id,
                            pending.file,
                            pending.documentType,
                            pending.description.trim() || undefined,
                            (percent) => {
                                setPendingDocumentUploadStates((prev) => {
                                    const next = new Map(prev);
                                    const cur = next.get(pending.id);
                                    // Обновляем, только пока статус uploading —
                                    // не перезаписываем success/error.
                                    if (cur && cur.status === 'uploading') {
                                        next.set(pending.id, { ...cur, progress: percent });
                                    }
                                    return next;
                                });
                            }
                        );
                        setPendingDocumentUploadStates((prev) => {
                            const next = new Map(prev);
                            next.set(pending.id, { status: 'success', progress: 100 });
                            return next;
                        });
                    } catch (err) {
                        failed++;
                        console.error('Ошибка загрузки документа:', err);
                        setPendingDocumentUploadStates((prev) => {
                            const next = new Map(prev);
                            next.set(pending.id, {
                                status: 'error',
                                progress: 0,
                                error: 'Ошибка загрузки',
                            });
                            return next;
                        });
                    }
                }

                // Итоговый тост — после завершения всех загрузок.
                if (failed > 0) {
                    toast.error(
                        `Программа создана, но ${failed} из ${total} документов не удалось загрузить`
                    );
                } else {
                    toast.success('Программа «Ноль травм» запущена, документы загружены');
                }

                // Пауза, чтобы пользователь увидел финальное состояние
                // прогресс-баров. При ошибках — дольше.
                await new Promise((resolve) =>
                    setTimeout(resolve, failed > 0 ? 1500 : 500)
                );
            } else {
                // Документов не было — обычное сообщение.
                toast.success('Программа «Ноль травм» успешно запущена');
            }

            userStartedNewRef.current = false;
            onChanged();
            finalizeClose();
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

    /**
     * Обновление программы.
     *
     * После успешного PUT запускаем загрузку отложенных документов через
     * императивный метод ZeroInjuryDocumentsManager.uploadPending(). Это
     * избавляет пользователя от необходимости сначала нажимать «Загрузить
     * все», а потом «Сохранить изменения»: достаточно выбрать документы и
     * нажать «Сохранить изменения».
     *
     * uploadPending() возвращает UploadZeroInjuryPendingResult { total, failed },
     * поэтому мы различаем три исхода и показываем честное сообщение:
     *   • total === 0            — документов не было;
     *   • total > 0, failed === 0 — всё загружено;
     *   • total > 0, failed > 0   — часть документов не загрузилась.
     *
     * Тост об успешном сохранении показывается ТОЛЬКО здесь, после загрузки
     * документов. Раньше он показывался сразу после PUT, и пользователь
     * видел «обновлена», пока модалка ещё крутилась на загрузке.
     *
     * Независимо от результата загрузки документов программа уже сохранена,
     * поэтому onChanged() и finalizeClose() вызываются в любом случае.
     * finalizeClose(), а не handleClose(), потому что submitting === true
     * (мы всё ещё внутри try), и handleClose() проигнорировал бы вызов.
     */
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

            // Загружаем отложенные документы, если пользователь добавил их
            // в очередь через менеджер документов. Раньше для этого нужно
            // было нажать отдельную кнопку «Загрузить все»; теперь загрузка
            // выполняется в рамках той же операции сохранения.
            let uploadResult: UploadZeroInjuryPendingResult | null = null;
            if (docsManagerRef.current) {
                uploadResult = await docsManagerRef.current.uploadPending();
            }

            // Показываем итоговое сообщение в зависимости от результата.
            if (uploadResult && uploadResult.total > 0) {
                if (uploadResult.failed > 0) {
                    // Программа сохранена, но часть документов не загрузилась.
                    // Это не ошибка сохранения — не валим сценарий, но честно сообщаем.
                    toast.error(
                        `Программа обновлена, но ${uploadResult.failed} из ${uploadResult.total} документов не удалось загрузить`
                    );
                } else {
                    toast.success('Программа обновлена, документы загружены');
                }
            } else {
                // Документов не было — обычное сообщение.
                toast.success('Программа обновлена');
            }

            onChanged();
            finalizeClose();
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
     *
     * Если удаляется та программа, которая открыта в форме/просмотре,
     * модалка закрывается принудительно через finalizeClose(): программа
     * удалена, проверять submitting бессмысленно.
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
                finalizeClose();
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
    // Метод вызывается только из UI, который доступен Safety/Admin, но для
    // подстраховки оставляем явную проверку прав и в самом обработчике.
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
        // Сброс pending-документов: если пользователь уже добавлял их
        // в предыдущей сессии, они не должны «прилипать» к новой.
        setPendingDocuments([]);
        setPendingDocumentUploadStates(new Map());
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
    //
    // Возвращает form, который сам по себе flex-контейнер: поля скроллятся
    // (flex-1 overflow-y-auto), а footer с кнопками прибит к низу
    // (flex-shrink-0). Благодаря этому кнопки «Удалить программу»,
    // «Назад», «Отмена» и «Сохранить/Создать» всегда видны без скролла,
    // даже если полей и прикреплённых документов много.
    //
    // min-h-0 на форме — обязательное условие: без него flexbox не
    // даёт содержимому сжаться ниже естественного размера, и
    // overflow-y-auto внутри не срабатывает.
    // ------------------------------------------------------------------
    const renderForm = () => {
        const isCreate = mode === 'create';
        const form = isCreate ? createForm : editForm;
        const onSubmit = isCreate ? handleCreate : handleUpdate;
        const submitLabel = isCreate ? 'Создать' : 'Сохранить изменения';

        return (
            <form
                onSubmit={form.handleSubmit(onSubmit as any)}
                className="flex flex-col flex-1 min-h-0"
            >
                {/* Прокручиваемая область с полями. flex-1 забирает всё
                    доступное пространство, overflow-y-auto добавляет скролл,
                    если контента больше, чем помещается. space-y-5 —
                    отступы между полями, как и раньше. */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-5">
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

                    {/* Документы:
                        • в режиме создания — PendingZeroInjuryDocumentsManager
                          (пользователь выбирает документы ДО создания программы,
                          загрузка происходит после POST с реальным прогрессом);
                        • в режиме редактирования — ZeroInjuryDocumentsManager
                          (программа уже существует, у неё есть programId).
                          В этом режиме документы загружаются по кнопке
                          «Сохранить изменения» — через ref и uploadPending(),
                          как в InjuryFilesManager для травм. Отдельная кнопка
                          «Загрузить все» скрыта (hideUploadAllButton). */}
                    {isCreate && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                                Прикреплённые документы
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Необязательно. Приказы, распоряжения, акты и другие документы.
                                Будут загружены при создании программы — прогресс появится здесь.
                            </p>
                            <PendingZeroInjuryDocumentsManager
                                pendingDocuments={pendingDocuments}
                                onAddDocuments={addPendingDocuments}
                                onRemoveDocument={removePendingDocument}
                                onUpdateDescription={updatePendingDocumentDescription}
                                onUpdateDocumentType={updatePendingDocumentType}
                                uploadStates={pendingDocumentUploadStates}
                                disabled={submitting}
                            />
                        </div>
                    )}

                    {!isCreate && editingProgram && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                                Прикреплённые документы
                            </h4>
                            {/*
                              В режиме редактирования менеджер получает:
                                • ref — через него handleUpdate вызывает uploadPending()
                                  после успешного PUT, чтобы документы ушли по кнопке
                                  «Сохранить изменения»;
                                • hideUploadAllButton — скрывает отдельную кнопку
                                  «Загрузить все», чтобы не было двухшагового сценария
                                  (ровно так же это сделано для InjuryFilesManager).
                              Прогресс загрузки здесь реальный: uploadAll передаёт
                              onProgress в safetyService.uploadZeroInjuryDocument,
                              а тот — в axios.
                            */}
                            <ZeroInjuryDocumentsManager
                                ref={docsManagerRef}
                                programId={editingProgram.id}
                                isEditable={true}
                                hideUploadAllButton={true}
                            />
                        </div>
                    )}
                </div>

                {/* Footer с кнопками. flex-shrink-0 — не сжимается, всегда
                    виден внизу модалки. rounded-b-2xl — совпадает со
                    скруглением модалки. bg-white dark:bg-gray-800 —
                    перекрывает возможные артефакты скролла под ним. */}
                <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
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
                                        // Сбрасываем pending-документы при возврате
                                        // из формы создания — чтобы они не «прилипли»
                                        // к следующей попытке.
                                        setPendingDocuments([]);
                                        setPendingDocumentUploadStates(new Map());
                                    }}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-colors"
                                >
                                    Назад
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={submitting}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                </div>
            </form>
        );
    };

    // ------------------------------------------------------------------
    // Просмотр активной/завершённой программы (вкладка «Период»).
    //
    // Возвращает flex-контейнер: контент скроллится (flex-1 overflow-y-auto),
    // а footer с кнопками «Удалить период» и «Закрыть» прибит к низу
    // (flex-shrink-0) — всегда виден без скролла.
    // ------------------------------------------------------------------
    const renderView = () => {
        const program = editingProgram ?? status.currentProgram ?? status.lastFinalizedProgram;
        if (!program) {
            // Для Safety/Admin без программы — показываем форму создания.
            // Для обычного пользователя — заглушку с пояснением.
            if (isSafetyEngineer) return renderForm();
            return (
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                        Программа «Ноль травм» не запущена.
                    </div>
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
            <div className="flex flex-col flex-1 min-h-0">
                {/* Прокручиваемая область с содержимым программы. */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-5">
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
                </div>

                {/* Footer с кнопками. flex-shrink-0 — не сжимается, всегда
                    виден внизу модалки. rounded-b-2xl — совпадает со
                    скруглением модалки. */}
                <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ------------------------------------------------------------------
    // Вкладка «История» — все завершённые периоды.
    //
    // Только прокручиваемый контент, footer не нужен: закрытие модалки
    // доступно через X в шапке. Если когда-нибудь понадобятся кнопки
    // внизу истории — добавить по образцу renderView.
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
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                        <FiList className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <div className="text-sm">История периодов пуста</div>
                        <div className="text-xs mt-1">
                            Завершённые и прерванные периоды появятся здесь автоматически.
                        </div>
                    </div>
                </div>
            );
        }

        // Считаем сводную статистику для заголовка вкладки.
        const completedCount = finalized.filter((p) => p.isSuccessfullyCompleted).length;
        const interruptedCount = finalized.length - completedCount;

        return (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
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
    //
    // Структура модалки:
    //   Modal (flex flex-col h-[92vh])
    //   ├── Header (flex-shrink-0, rounded-t-2xl)
    //   ├── Tabs (flex-shrink-0)
    //   ├── «Начать новый период» (flex-shrink-0, если показывается)
    //   └── Контент — одна из трёх веток (каждая сама управляет скроллом
    //       и футером):
    //       ├── renderForm()      — форма создания/редактирования
    //       ├── renderView()      — просмотр программы
    //       └── renderHistoryTab() — история периодов
    //
    // Благодаря h-[92vh] высота окна фиксирована и не «прыгает» при
    // переключении вкладок. Благодаря flex-shrink-0 на header/tabs/
    // startnew/footer и flex-1 min-h-0 на контенте кнопки действий
    // всегда видны внизу без скролла, а прокручивается только сам контент.
    // ------------------------------------------------------------------
    return (
        <div
            className="fixed inset-0 bg-black/60 dark:bg-gray-900/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
            /*
              Backdrop закрывает модалку только если клик пришёл ВНЕ
              <div ref={modalRef}>. Проверка через contains() надёжнее,
              чем e.target === e.currentTarget: она работает независимо
              от того, насколько глубоко в DOM находится target (SVG внутри
              кнопки, span внутри лейбла и т.п.).

              Это defense-in-depth: даже если всплытие события случится
              (например, из-за синхронного window.confirm где-то в глубине),
              модалка не закроется, пока клик был внутри неё. Дополнительно
              handleClose блокируется, пока submitting === true.
            */
            onMouseDown={(e) => {
                if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                    handleClose();
                }
            }}
        >
            <div
                ref={modalRef}
                /*
                  h-[92vh] вместо max-h-[92vh]:
                  фиксированная высота 92% высоты viewport. Благодаря этому
                  переключение вкладок «Период» ↔ «История» больше не меняет
                  высоту окна — оно всегда одного размера.

                  flex flex-col — контейнер распределяет пространство между
                  header, tabs, «Начать новый период», контентом и footer'ом.
                  Контент (форма/view/history) получает flex-1 и внутренний
                  overflow-y-auto — скроллится только он. Header, tabs и
                  footer — flex-shrink-0, поэтому не сжимаются и не
                  уезжают за пределы окна.
                */
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[92vh]"
            >
                {/* Заголовок. flex-shrink-0 — не сжимается, всегда виден. */}
                <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        {getIcon()} {getTitle()}
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ${submitting ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                        aria-label="Закрыть"
                        title={submitting ? 'Дождитесь завершения операции' : 'Закрыть'}
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Вкладки. flex-shrink-0 — не сжимаются. */}
                <div className="flex-shrink-0 px-5 pt-4">
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

                {/*
                  Кнопка «Начать новый период».

                  Видна ТОЛЬКО когда одновременно выполняются три условия:
                    1) пользователь — Safety или Admin (isSafetyEngineer);
                    2) открыта вкладка «Период» (tab === 'period');
                    3) мы НЕ внутри формы создания (mode !== 'create') —
                       иначе кнопка «Создать» в самой форме уже делает то же самое.

                  Для обычного пользователя этот блок не рендерится вовсе —
                  никакого disabled-состояния, никакого визуального шума.

                  flex-shrink-0 — не сжимается, всегда виден под вкладками.
                */}
                {isSafetyEngineer && tab === 'period' && mode !== 'create' && (
                    <div className="flex-shrink-0 px-5 pt-4">
                        <button
                            type="button"
                            onClick={handleStartNew}
                            disabled={!status.canStartNew || submitting}
                            title={
                                !status.canStartNew
                                    ? 'Дождитесь завершения текущего периода'
                                    : 'Начать новый период'
                            }
                            className={`w-full py-2.5 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${status.canStartNew && !submitting
                                ? 'border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <FiEdit3 className="w-4 h-4" />
                            <span>Начать новый период</span>
                        </button>
                    </div>
                )}

                {/* Контент активной вкладки. Каждая из трёх веток сама
                    управляет своим скроллом и футером — см. подробные
                    комментарии в renderForm / renderView / renderHistoryTab. */}
                {tab === 'period' && (mode === 'create' || mode === 'edit') && renderForm()}
                {tab === 'period' && mode === 'view' && renderView()}
                {tab === 'history' && renderHistoryTab()}
            </div>
        </div>
    );
};

export default ZeroInjuryModal;