/**
 * Модальное окно для просмотра, создания и редактирования травмы.
 * Содержит в себе формы и управление файлами.
 * Режим определяется наличием selectedInjury и ролью пользователя:
 *   • если есть selectedInjury и пользователь — инженер ТБ/админ → 'edit';
 *   • если есть selectedInjury и пользователь без прав → 'view';
 *   • если нет selectedInjury и пользователь — инженер ТБ/админ → 'create';
 *   • если нет selectedInjury и пользователь без прав → 'view' (пустой экран,
 *     но такое состояние не должно возникать, т.к. родитель не открывает модалку).
 *
 * В режиме редактирования файлы, добавленные через InjuryFilesManager,
 * загружаются автоматически при нажатии кнопки «Сохранить» — для этого
 * компонент держит ref на InjuryFilesManager и вызывает его императивный
 * метод uploadPending() после успешного обновления травмы.
 *
 * В режиме создания файлы загружаются в handleCreate последовательно,
 * с РЕАЛЬНЫМ прогрессом: состояния загрузки складываются в
 * pendingUploadStates и передаются в PendingFilesManager, который
 * рисует полосу и статус-иконку для каждого файла. Пользователь видит,
 * как файлы уходят, прямо в модалке — она не закрывается до завершения
 * загрузки.
 *
 * Тост об успешном сохранении показывается ПОСЛЕ загрузки файлов, а не
 * сразу после PUT/POST. Иначе пользователь видел бы «обновлена/создана»,
 * пока модалка ещё крутится на загрузке файлов. Кроме того, различаются
 * три исхода:
 *   • файлов не было — «Запись создана/обновлена»;
 *   • все файлы загружены — «Запись создана/обновлена, файлы загружены»;
 *   • часть файлов не загрузилась — «Запись создана/обновлена, но N из M
 *     файлов не удалось загрузить». Запись при этом уже сохранена,
 *     поэтому onInjuryChanged() и finalizeClose() вызываются в любом случае.
 *
 * Два способа закрытия модалки:
 *
 *  • handleClose() — обычное, пользовательское закрытие. Проверяет, не
 *    идёт ли сейчас создание или обновление (creating/updating), и если
 *    идёт — игнорирует вызов. Используется во всех точках пользовательского
 *    закрытия: кнопка X, клик по backdrop, кнопки «Отмена» и «Закрыть».
 *
 *  • finalizeClose() — принудительное закрытие. Не проверяет никаких
 *    условий и вызывает onClose(). Используется ТОЛЬКО из обработчиков
 *    успеха (handleCreate, handleUpdate, handleDelete), где операция
 *    уже завершена, и никаких проверок не требуется.
 *
 * Разделение на две функции сделано осознанно. Раньше в handleCreate и
 * handleUpdate вызывался handleClose(), и это работало только благодаря
 * тому, что handleClose брался из старого замыкания (рендер, где
 * creating === false). Стоило бы обернуть handleClose в useCallback с
 * зависимостью от creating — и модалка перестала бы закрываться после
 * успешного сохранения. Теперь логика явная: пользовательские точки
 * закрытия идут через handleClose() с проверкой, а успешное завершение
 * операции — через finalizeClose() без проверки.
 *
 * Backdrop.
 *
 * Backdrop проверяет через ref + contains(): модалка закрывается только
 * если клик пришёл вне <div ref={modalRef}>. Это defense-in-depth: даже
 * если всплытие события случится (например, из-за синхронного
 * window.confirm где-то в глубине), модалка не закроется, пока клик был
 * внутри неё.
 */
import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { FiX, FiPlus, FiActivity, FiPaperclip, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { safetyService } from '../../../services/greenCross/api';
import type { InjuryDto, CreateInjuryRequest, UpdateInjuryRequest } from '../../../types/greenCross';
import { CreateEditInjuryForm } from '../forms';
import { PendingFilesManager, InjuryFilesManager } from '../files';
import type {
    InjuryFilesManagerHandle,
    UploadPendingResult,
    PendingFileUploadState,
} from '../files';
import { categoryOptions } from '../../../constants/greenCross/categories';

interface InjuryModalProps {
    selectedDate: Date | null;
    selectedInjury: InjuryDto | null;
    isSafetyEngineer: boolean;
    onClose: () => void;
    onInjuryChanged: () => void; // вызывается после создания/обновления/удаления
}

type ModalMode = 'view' | 'create' | 'edit';

// Константы валидации файлов – соответствуют бэкенду
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

const InjuryModal: React.FC<InjuryModalProps> = ({
    selectedDate,
    selectedInjury,
    isSafetyEngineer,
    onClose,
    onInjuryChanged,
}) => {
    const [mode, setMode] = useState<ModalMode>('view');
    const [pendingFiles, setPendingFiles] = useState<any[]>([]); // тип PendingFile из PendingFilesManager
    const [creating, setCreating] = useState(false);
    const [updating, setUpdating] = useState(false);

    // Состояния загрузки файлов в режиме создания: id файла → статус/прогресс.
    // Передаётся в PendingFilesManager, чтобы показать реальный прогресс
    // каждого файла. Сбрасывается в finalizeClose.
    const [pendingUploadStates, setPendingUploadStates] = useState<
        Map<string, PendingFileUploadState>
    >(new Map());

    // Ref на менеджер файлов в режиме редактирования. Через него
    // handleUpdate запускает загрузку отложенных файлов по кнопке «Сохранить».
    const filesManagerRef = useRef<InjuryFilesManagerHandle>(null);

    // Ref на внутренний контейнер модалки. Используется backdrop-обработчиком,
    // чтобы понять, был ли клик внутри модалки или вне её. Проверка через
    // contains() надёжнее, чем e.target === e.currentTarget: она работает
    // даже если target — глубоко вложенный SVG/span внутри кнопки.
    const modalRef = useRef<HTMLDivElement>(null);

    // Определяем режим при открытии.
    // ВАЖНО: режим 'create' выставляется ТОЛЬКО если пользователь имеет
    // права на редактирование (инженер ТБ/админ). Иначе — 'view'.
    useEffect(() => {
        if (selectedInjury) {
            setMode(isSafetyEngineer ? 'edit' : 'view');
        } else if (isSafetyEngineer) {
            setMode('create');
        } else {
            // Пользователь без прав нажал на день без травмы.
            // Родитель такое не пропускает, но на всякий случай — 'view'.
            setMode('view');
        }
    }, [selectedInjury, isSafetyEngineer]);

    /**
     * Обычное, пользовательское закрытие модалки.
     *
     * Используется во всех точках, где пользователь явно закрывает
     * модалку: кнопка X в шапке, клик по backdrop, кнопки «Отмена»
     * и «Закрыть».
     *
     * Если прямо сейчас идёт создание или обновление (creating ||
     * updating), вызов игнорируется: закрывать модалку во время
     * загрузки файлов нельзя, иначе пользователь потеряет прогресс,
     * а промисы продолжат обновлять состояние уже размонтированного
     * компонента.
     *
     * ВАЖНО: НЕ используется для программного закрытия после успешной
     * операции. Для этого есть finalizeClose(). Разделение ролей
     * устраняет зависимость от «старого замыкания» и делает поведение
     * предсказуемым.
     */
    const handleClose = () => {
        if (creating || updating) return;
        finalizeClose();
    };

    /**
     * Принудительное закрытие модалки.
     *
     * Вызывается ТОЛЬКО из обработчиков успеха (handleCreate,
     * handleUpdate, handleDelete), где операция уже завершена и
     * никакие проверки не нужны. Также сбрасывает pending-состояния,
     * чтобы при повторном открытии модалки не было «фантомных» файлов
     * и статусов загрузки.
     *
     * Название «finalize» подчёркивает, что это финальный шаг операции,
     * а не пользовательское действие.
     */
    const finalizeClose = () => {
        setPendingFiles([]);
        setPendingUploadStates(new Map());
        onClose();
    };

    // Валидация одного файла (соответствует бэкенд-валидатору UploadFileFormValidator)
    const validateFile = (file: File): { valid: boolean; error?: string } => {
        if (file.size > MAX_FILE_SIZE) {
            return { valid: false, error: `Файл "${file.name}" превышает 10 МБ` };
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
            return { valid: false, error: `Файл "${file.name}" имеет недопустимый тип. Разрешены: JPEG, PNG, PDF` };
        }
        return { valid: true };
    };

    // Добавление файлов в очередь с валидацией
    const addPendingFiles = (files: File[]) => {
        const validFiles: File[] = [];
        for (const file of files) {
            const { valid, error } = validateFile(file);
            if (!valid) {
                toast.error(error);
            } else {
                validFiles.push(file);
            }
        }
        if (validFiles.length === 0) return;

        const newFiles = validFiles.map((file) => ({
            id: `${Date.now()}-${Math.random()}-${file.name}`,
            file,
            description: '',
        }));
        setPendingFiles((prev) => [...prev, ...newFiles]);
        toast.success(`Добавлено файлов: ${validFiles.length}`);
    };

    const removePendingFile = (id: string) => {
        setPendingFiles((prev) => prev.filter((f) => f.id !== id));
        toast('Файл удалён из очереди', { icon: '🗑️' });
    };

    const updatePendingFileDescription = (id: string, description: string) => {
        setPendingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, description } : f)));
    };

    // Создание травмы (вызывается из формы).
    //
    // После POST /injuries последовательно загружаем файлы, обновляя
    // pendingUploadStates через onProgress. PendingFilesManager рисует
    // реальный прогресс каждого файла. Модалка закрывается только после
    // завершения всех загрузок (или сразу, если файлов не было).
    //
    // Закрытие выполняется через finalizeClose(), а не через handleClose():
    // на этот момент creating === true (мы всё ещё внутри try), и
    // handleClose() проигнорировал бы вызов. finalizeClose() закрывает
    // принудительно, потому что операция уже успешно завершена.
    const handleCreate = async (data: CreateInjuryRequest) => {
        if (!selectedDate) {
            toast.error('Дата не выбрана');
            return;
        }
        setCreating(true);
        try {
            const newInjury = await safetyService.create({
                ...data,
                date: format(selectedDate, 'yyyy-MM-dd'),
            });

            const total = pendingFiles.length;
            let failed = 0;

            if (total > 0) {
                // Инициализируем состояния: все файлы — 'uploading', progress 0.
                // Это сразу показывает пользователю, что процесс пошёл.
                const initial = new Map<string, PendingFileUploadState>();
                for (const pf of pendingFiles) {
                    initial.set(pf.id, { status: 'uploading', progress: 0 });
                }
                setPendingUploadStates(initial);

                // Загружаем последовательно, чтобы не создавать пиковую
                // нагрузку на сервер и не запутаться в обновлениях Map.
                for (const pending of pendingFiles) {
                    try {
                        await safetyService.uploadFile(
                            newInjury.id,
                            pending.file,
                            pending.description || undefined,
                            (percent) => {
                                setPendingUploadStates((prev) => {
                                    const next = new Map(prev);
                                    const cur = next.get(pending.id);
                                    // Обновляем только если файл всё ещё в статусе
                                    // uploading — не перезаписываем success/error.
                                    if (cur && cur.status === 'uploading') {
                                        next.set(pending.id, { ...cur, progress: percent });
                                    }
                                    return next;
                                });
                            }
                        );
                        setPendingUploadStates((prev) => {
                            const next = new Map(prev);
                            next.set(pending.id, { status: 'success', progress: 100 });
                            return next;
                        });
                    } catch (err) {
                        failed++;
                        console.error('Ошибка загрузки файла:', err);
                        setPendingUploadStates((prev) => {
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

                // Итоговое сообщение — после завершения всех загрузок.
                if (failed > 0) {
                    toast.error(
                        `Травма создана, но ${failed} из ${total} файлов не удалось загрузить`
                    );
                } else {
                    toast.success('Запись о травме успешно создана, файлы загружены');
                }

                // Небольшая пауза, чтобы пользователь увидел финальное
                // состояние прогресс-баров (все 100% / ошибки) перед
                // закрытием модалки. 1.5 сек — при ошибках, 0.5 сек — при успехе.
                await new Promise((resolve) => setTimeout(resolve, failed > 0 ? 1500 : 500));
            } else {
                toast.success('Запись о травме успешно создана');
            }

            onInjuryChanged();
            finalizeClose();
        } catch (error) {
            console.error(error);
            toast.error('Не удалось создать травму');
        } finally {
            setCreating(false);
        }
    };

    // Обновление травмы.
    //
    // После успешного PUT запускаем загрузку отложенных файлов через
    // императивный метод InjuryFilesManager.uploadPending(). Это избавляет
    // пользователя от необходимости сначала нажимать «Загрузить все»,
    // а потом «Сохранить»: достаточно выбрать файлы и нажать «Сохранить».
    //
    // uploadPending() возвращает UploadPendingResult { total, failed },
    // поэтому мы различаем три исхода и показываем честное сообщение:
    //   • total === 0            — файлов не было;
    //   • total > 0, failed === 0 — всё загружено;
    //   • total > 0, failed > 0   — часть файлов не загрузилась.
    //
    // Тост об успешном сохранении показывается ТОЛЬКО здесь, после загрузки
    // файлов. Раньше он показывался сразу после PUT, и пользователь видел
    // «обновлена», пока модалка ещё крутилась на загрузке.
    //
    // Независимо от результата загрузки файлов травма уже сохранена,
    // поэтому onInjuryChanged() и finalizeClose() вызываются в любом случае.
    // finalizeClose(), а не handleClose(), потому что updating === true
    // (мы всё ещё внутри try), и handleClose() проигнорировал бы вызов.
    const handleUpdate = async (data: UpdateInjuryRequest) => {
        if (!selectedInjury) return;
        setUpdating(true);
        try {
            await safetyService.update(selectedInjury.id, data);

            // Загружаем отложенные файлы, если пользователь добавил их
            // в очередь через менеджер файлов. Раньше для этого нужно было
            // нажать отдельную кнопку «Загрузить все»; теперь загрузка
            // выполняется в рамках той же операции сохранения.
            let uploadResult: UploadPendingResult | null = null;
            if (filesManagerRef.current) {
                uploadResult = await filesManagerRef.current.uploadPending();
            }

            // Показываем итоговое сообщение в зависимости от результата.
            if (uploadResult && uploadResult.total > 0) {
                if (uploadResult.failed > 0) {
                    // Травма сохранена, но часть файлов не загрузилась.
                    // Это не ошибка сохранения — не валим сценарий, но честно сообщаем.
                    toast.error(
                        `Травма сохранена, но ${uploadResult.failed} из ${uploadResult.total} файлов не удалось загрузить`
                    );
                } else {
                    toast.success('Запись о травме обновлена, файлы загружены');
                }
            } else {
                // Файлов не было — обычное сообщение.
                toast.success('Запись о травме обновлена');
            }

            onInjuryChanged();
            finalizeClose();
        } catch (error) {
            console.error(error);
            toast.error('Не удалось обновить травму');
        } finally {
            setUpdating(false);
        }
    };

    // Удаление травмы.
    //
    // Операция короткая, но после неё травмы уже нет — модалку надо
    // закрыть принудительно, без проверок. Поэтому finalizeClose().
    const handleDelete = async () => {
        if (!selectedInjury) return;
        if (!confirm('Вы уверены, что хотите удалить эту травму? Это действие необратимо.')) return;
        try {
            await safetyService.delete(selectedInjury.id);
            toast.success('Запись о травме удалена');
            onInjuryChanged();
            finalizeClose();
        } catch (error) {
            console.error(error);
            toast.error('Не удалось удалить травму');
        }
    };

    // Получить человекочитаемое название категории по её значению
    const getCategoryLabel = (value: string): string => {
        const found = categoryOptions.find((opt) => opt.value === value);
        return found ? found.label : value;
    };

    // Рендер содержимого в зависимости от режима
    const renderContent = () => {
        if (mode === 'view' && selectedInjury) {
            return (
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата</label>
                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200">
                            {selectedDate ? format(selectedDate, 'dd.MM.yyyy') : ''}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Категория происшествия</label>
                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200">
                            {getCategoryLabel(selectedInjury.category)}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Тип происшествия</label>
                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200">
                            {selectedInjury.type}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200 min-h-[160px] whitespace-pre-wrap">
                            {selectedInjury.description}
                        </div>
                    </div>
                    <div>
                        <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <FiPaperclip className="w-4 h-4" /> Прикреплённые документы
                            </h4>
                            <InjuryFilesManager injuryId={selectedInjury.id} isEditable={false} />
                        </div>
                    </div>
                </div>
            );
        }

        if (mode === 'create') {
            return (
                <CreateEditInjuryForm
                    mode="create"
                    selectedDate={selectedDate}
                    initialValues={{ type: '', description: '', category: '' }}
                    onSubmit={handleCreate}
                    isSubmitting={creating}
                >
                    {/* Дополнительная колонка: менеджер файлов для новой травмы */}
                    <div className="md:w-1/2">
                        <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <FiPaperclip className="w-4 h-4" /> Прикреплённые документы
                            </h4>
                            {/*
                              В режиме создания PendingFilesManager получает:
                                • uploadStates — карту id → { status, progress, error },
                                  которую заполняет handleCreate по мере загрузки.
                                  Это позволяет показать РЕАЛЬНЫЙ прогресс каждого файла;
                                • disabled — блокирует добавление/редактирование/удаление
                                  файлов, пока идёт загрузка (creating).
                            */}
                            <PendingFilesManager
                                pendingFiles={pendingFiles}
                                onAddFiles={addPendingFiles}
                                onRemoveFile={removePendingFile}
                                onUpdateDescription={updatePendingFileDescription}
                                uploadStates={pendingUploadStates}
                                disabled={creating}
                            />
                        </div>
                    </div>
                </CreateEditInjuryForm>
            );
        }

        if (mode === 'edit' && selectedInjury) {
            return (
                <CreateEditInjuryForm
                    mode="edit"
                    selectedDate={selectedDate}
                    initialValues={{
                        type: selectedInjury.type,
                        description: selectedInjury.description,
                        category: selectedInjury.category,
                    }}
                    onSubmit={handleUpdate}
                    isSubmitting={updating}
                    onDelete={handleDelete}
                >
                    <div className="md:w-1/2">
                        <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <FiPaperclip className="w-4 h-4" /> Прикреплённые документы
                            </h4>
                            {/*
                              В режиме редактирования менеджер получает:
                                • ref — через него handleUpdate вызывает uploadPending()
                                  после успешного PUT, чтобы файлы ушли по кнопке «Сохранить»;
                                • hideUploadAllButton — скрывает отдельную кнопку
                                  «Загрузить все», чтобы не было двухшагового сценария.
                              Прогресс загрузки здесь реальный: uploadAll передаёт
                              onProgress в safetyService.uploadFile, а тот — в axios.
                            */}
                            <InjuryFilesManager
                                ref={filesManagerRef}
                                injuryId={selectedInjury.id}
                                isEditable={true}
                                hideUploadAllButton={true}
                            />
                        </div>
                    </div>
                </CreateEditInjuryForm>
            );
        }

        return null;
    };

    const getTitle = () => {
        if (mode === 'create') return 'Добавить травму';
        if (mode === 'edit') return 'Редактировать травму';
        return 'Информация о травме';
    };

    const getIcon = () => {
        if (mode === 'create') return <FiPlus className="text-green-500" />;
        if (mode === 'edit') return <FiActivity className="text-blue-500" />;
        return <FiPaperclip className="text-gray-500" />;
    };

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
              модалка не закроется, пока клик был внутри неё.
            */
            onMouseDown={(e) => {
                if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                    handleClose();
                }
            }}
        >
            <div
                ref={modalRef}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]"
            >
                {/* Заголовок */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        {getIcon()} {getTitle()}
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ${creating || updating ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                        disabled={creating || updating}
                        title={
                            creating || updating
                                ? 'Дождитесь завершения операции'
                                : 'Закрыть'
                        }
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Содержимое с прокруткой */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">{renderContent()}</div>
            </div>
        </div>
    );
};

export default InjuryModal;