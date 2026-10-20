/**
 * Компонент для управления документами программы «Ноль травм»:
 * загрузка, скачивание, удаление.
 * Работает по аналогии с InjuryFilesManager, но с учётом типа документа.
 *
 * Поддерживает РЕАЛЬНЫЙ прогресс загрузки (через axios onUploadProgress
 * в safetyService.uploadZeroInjuryDocument). Пока документ отправляется,
 * в очереди показывается полоса прогресса и процент. Это устраняет
 * «слепую зону», когда пользователь видел только спиннер и не понимал,
 * сколько ещё ждать (особенно для DOCX/XLSX до 20 МБ).
 *
 * Компонент обёрнут в forwardRef и предоставляет наружу императивный
 * метод uploadPending(). Это нужно, чтобы родитель (ZeroInjuryModal) мог
 * инициировать загрузку отложенных документов прямо из обработчика кнопки
 * «Сохранить изменения» — без отдельной кнопки «Загрузить все». Ровно так
 * же это сделано для InjuryFilesManager в режиме редактирования травмы.
 *
 * uploadPending() возвращает UploadZeroInjuryPendingResult с количеством
 * запланированных и неудавшихся загрузок. Это позволяет родителю
 * показать честное сообщение: «программа обновлена и документы загружены»,
 * «программа обновлена, но часть документов не загрузилась» или
 * «программа обновлена без документов». Простое проглатывание ошибок
 * внутри uploadAll не даёт отличить эти сценарии, а try/catch
 * вокруг uploadPending не сработал бы: uploadAll не бросает
 * исключения, а обрабатывает ошибки пофайлово (частичный успех —
 * нормальный сценарий).
 *
 * Автоскролл: при старте uploadAll() контейнер очереди прокручивается
 * в зону видимости. Без этого пользователь мог нажать «Сохранить изменения»
 * и не увидеть полосы прогресса, потому что очередь находится ниже
 * полей формы и уходит за границу прокрутки модалки.
 *
 * ВАЖНО про type="button".
 *
 * Компонент рендерится внутри модалки, которая в свою очередь находится
 * внутри <form> (форма создания/редактирования программы). Все кнопки
 * здесь помечены type="button", чтобы клик по ним не вызывал submit
 * формы и не приводил к преждевременному закрытию модалки или
 * сохранению программы.
 */
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    forwardRef,
    useImperativeHandle,
} from 'react';
import {
    FiDownload,
    FiTrash2,
    FiUpload,
    FiFile,
    FiImage,
    FiFileText,
    FiX,
    FiLoader,
    FiAlertTriangle,
    FiCheck,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { safetyService } from '../../../services/greenCross/api';
import type { ZeroInjuryDocumentDto } from '../../../types/greenCross';
import {
    documentTypeOptions,
    getDocumentTypeLabel,
} from '../../../constants/greenCross/documentTypes';

// ----------------------------------------------------------------------
// Константы валидации (соответствуют бэкенду UploadZeroInjuryDocumentFormValidator)
// ----------------------------------------------------------------------
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// ----------------------------------------------------------------------
// Вспомогательные функции
// ----------------------------------------------------------------------
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
};

const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/'))
        return <FiImage className="w-5 h-5 text-blue-500" />;
    if (contentType === 'application/pdf')
        return <FiFileText className="w-5 h-5 text-red-500" />;
    return <FiFile className="w-5 h-5 text-gray-500" />;
};

// ----------------------------------------------------------------------
// Тип очереди загрузки
// ----------------------------------------------------------------------
interface UploadingDoc {
    id: string;
    file: File;
    description: string;
    documentType: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
    /** Процент загрузки (0-100). Обновляется через axios onUploadProgress. */
    progress: number;
    error?: string;
    uploaded?: ZeroInjuryDocumentDto;
}

/**
 * Результат загрузки отложенных документов.
 *
 * total  — сколько документов было в очереди со статусом 'pending' на момент вызова.
 * failed — сколько из них не удалось загрузить (сервер вернул ошибку).
 *
 * Если total === 0, значит, загружать было нечего (пользователь не добавлял
 * документов или все они уже загружены в предыдущих итерациях).
 */
export interface UploadZeroInjuryPendingResult {
    total: number;
    failed: number;
}

/**
 * Императивный интерфейс компонента.
 *
 * Позволяет родителю (ZeroInjuryModal) запустить загрузку всех документов,
 * находящихся в очереди со статусом 'pending', в момент сохранения программы.
 * Ошибки загрузки отдельных документов показываются через toast внутри
 * uploadAll и не пробрасываются наружу — промис всегда резолвится,
 * чтобы не ломать сценарий сохранения. Информация о неудачах приходит
 * через UploadZeroInjuryPendingResult.
 */
export interface ZeroInjuryDocumentsManagerHandle {
    /**
     * Загрузить все документы, находящиеся в очереди со статусом 'pending'.
     * Если очередь пуста — возвращает { total: 0, failed: 0 }.
     * Промис резолвится, когда все загрузки завершены (успешно или с ошибкой).
     */
    uploadPending: () => Promise<UploadZeroInjuryPendingResult>;
}

interface ZeroInjuryDocumentsManagerProps {
    programId: string;
    isEditable: boolean;
    /**
     * Скрыть кнопку «Загрузить все».
     *
     * Используется в режиме редактирования программы: там загрузка документов
     * выполняется автоматически при нажатии «Сохранить изменения» (см.
     * ZeroInjuryModal.handleUpdate). Вместо кнопки показывается подсказка
     * «Документы будут загружены при сохранении программы». Ровно так же
     * ведёт себя InjuryFilesManager в режиме редактирования травмы.
     */
    hideUploadAllButton?: boolean;
}

// ----------------------------------------------------------------------
// Общие CSS-классы для полей ввода и селектов внутри очереди загрузки.
// Вынесены отдельно, чтобы в обеих ветках (в форме и в PendingFilesManager)
// использовался одинаковый стиль.
//
// Ключевые моменты:
//  • `[color-scheme:dark]` в тёмной теме — заставляет браузер использовать
//    тёмную нативную палитру для <select> (стрелка, выпадающий список,
//    скроллбар). Без этого Chrome/Safari рисуют нативные части светлыми.
//  • Явный `text-gray-800 dark:text-gray-100` — иначе текст в <select>
//    в тёмной теме может сливаться с фоном.
//  • `placeholder-gray-400 dark:placeholder-gray-500` — серый placeholder,
//    но заметно темнее в тёмной теме, чтобы не «резал глаз».
// ----------------------------------------------------------------------
const FIELD_BASE_CLASSES =
    'w-full px-2 py-1 text-xs border rounded-lg ' +
    'bg-gray-50 dark:bg-gray-700 ' +
    'border-gray-300 dark:border-gray-600 ' +
    'text-gray-800 dark:text-gray-100 ' +
    'placeholder-gray-400 dark:placeholder-gray-500 ' +
    'focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent ' +
    'dark:[color-scheme:dark]';

// ----------------------------------------------------------------------
// Компонент
// ----------------------------------------------------------------------
const ZeroInjuryDocumentsManager = forwardRef<
    ZeroInjuryDocumentsManagerHandle,
    ZeroInjuryDocumentsManagerProps
>(({ programId, isEditable, hideUploadAllButton = false }, ref) => {
    const [documents, setDocuments] = useState<ZeroInjuryDocumentDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [queue, setQueue] = useState<UploadingDoc[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Ref на контейнер очереди. Нужен для автоскролла: когда пользователь
    // нажимает «Сохранить изменения», очередь загрузки может быть ниже
    // видимой области модалки (она в overflow-y-auto). Скроллим её в зону
    // видимости, чтобы полосы прогресса были видны.
    const queueContainerRef = useRef<HTMLDivElement>(null);

    // Таймер очистки завершённых элементов очереди. Храним ссылку,
    // чтобы погасить его при размонтировании компонента: при сохранении
    // модалка закрывается сразу после загрузки документов, и без clearTimeout
    // таймер сработал бы уже на размонтированном компоненте.
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (clearTimerRef.current) {
                clearTimeout(clearTimerRef.current);
                clearTimerRef.current = null;
            }
        };
    }, []);

    // ------------------------------------------------------------------
    // Загрузка списка документов
    // ------------------------------------------------------------------
    const loadDocuments = useCallback(async () => {
        if (!programId) return;
        setLoading(true);
        try {
            const data = await safetyService.getZeroInjuryDocuments(programId);
            setDocuments(data);
        } catch (err) {
            console.error('Ошибка загрузки документов:', err);
            toast.error('Не удалось загрузить список документов');
        } finally {
            setLoading(false);
        }
    }, [programId]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    // ------------------------------------------------------------------
    // Валидация файла
    // ------------------------------------------------------------------
    const validateFile = (file: File): { valid: boolean; error?: string } => {
        if (file.size > MAX_FILE_SIZE) {
            return { valid: false, error: `Файл "${file.name}" превышает 20 МБ` };
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
            return {
                valid: false,
                error: `Тип файла "${file.name}" не поддерживается. Разрешены: JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX`,
            };
        }
        return { valid: true };
    };

    // ------------------------------------------------------------------
    // Добавление файлов в очередь
    // ------------------------------------------------------------------
    const addToQueue = (files: FileList | File[]) => {
        const newItems: UploadingDoc[] = [];
        for (const file of Array.from(files)) {
            const { valid, error } = validateFile(file);
            if (!valid) {
                toast.error(error);
                continue;
            }
            newItems.push({
                id: `${Date.now()}-${Math.random()}-${file.name}`,
                file,
                description: '',
                documentType: 'Other',
                status: 'pending',
                progress: 0,
            });
        }
        if (newItems.length) {
            setQueue((prev) => [...prev, ...newItems]);
            toast.success(`Добавлено документов: ${newItems.length}`);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) addToQueue(e.target.files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Drag&Drop
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isEditable) setIsDragging(true);
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
        if (!isEditable) return;
        if (e.dataTransfer.files.length) addToQueue(e.dataTransfer.files);
    };

    // ------------------------------------------------------------------
    // Управление очередью
    // ------------------------------------------------------------------
    const removeFromQueue = (id: string) => {
        setQueue((prev) => prev.filter((item) => item.id !== id));
    };

    const updateDescription = (id: string, description: string) => {
        setQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, description } : item))
        );
    };

    const updateDocumentType = (id: string, documentType: string) => {
        setQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, documentType } : item))
        );
    };

    // Загрузка всех документов из очереди с РЕАЛЬНЫМ прогрессом.
    //
    // Возвращает UploadZeroInjuryPendingResult, чтобы вызывающая сторона
    // могла отличить три исхода:
    //   • total === 0            — загружать было нечего;
    //   • total > 0, failed === 0 — всё загружено;
    //   • total > 0, failed > 0   — часть документов не загрузилась.
    //
    // Ошибки по отдельным документам не пробрасываются наружу: это
    // осознанное решение, потому что один упавший документ не должен
    // отменять успешную загрузку остальных и не должен ломать
    // сценарий сохранения программы в ZeroInjuryModal.
    //
    // Перед стартом очередь прокручивается в зону видимости: если
    // пользователь нажал «Сохранить изменения» наверху формы, без скролла
    // он не увидит полосы прогресса.
    const uploadAll = async (): Promise<UploadZeroInjuryPendingResult> => {
        const pending = queue.filter((item) => item.status === 'pending');
        if (pending.length === 0) {
            return { total: 0, failed: 0 };
        }

        // Прокручиваем очередь в зону видимости, чтобы пользователь
        // увидел прогресс-бары. behavior: 'smooth' — плавно, block: 'nearest' —
        // только если элемент вне видимой области (не дёргаем страницу зря).
        queueContainerRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });

        setQueue((prev) =>
            prev.map((item) =>
                item.status === 'pending' ? { ...item, status: 'uploading', progress: 0 } : item
            )
        );

        let failed = 0;

        for (const item of pending) {
            try {
                const uploaded = await safetyService.uploadZeroInjuryDocument(
                    programId,
                    item.file,
                    item.documentType,
                    item.description.trim() || undefined,
                    (percent) => {
                        setQueue((prev) =>
                            prev.map((q) =>
                                q.id === item.id ? { ...q, progress: percent } : q
                            )
                        );
                    }
                );
                setQueue((prev) =>
                    prev.map((q) =>
                        q.id === item.id
                            ? { ...q, status: 'success', progress: 100, uploaded }
                            : q
                    )
                );
                setDocuments((prev) => [...prev, uploaded]);
                toast.success(`Документ "${item.file.name}" загружен`);
            } catch (err) {
                failed++;
                console.error('Ошибка загрузки документа:', err);
                setQueue((prev) =>
                    prev.map((q) =>
                        q.id === item.id
                            ? { ...q, status: 'error', error: 'Ошибка загрузки' }
                            : q
                    )
                );
                toast.error(`Ошибка загрузки "${item.file.name}"`);
            }
        }

        // Через 3 секунды убираем успешные и ошибочные из очереди.
        // Таймер сохраняем в ref, чтобы погасить его при размонтировании
        // (модалка закрывается сразу после сохранения).
        if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current);
        }
        clearTimerRef.current = setTimeout(() => {
            setQueue((prev) => prev.filter((item) => item.status === 'pending'));
        }, 3000);

        return { total: pending.length, failed };
    };

    // ------------------------------------------------------------------
    // Императивный API для родителя (ZeroInjuryModal).
    //
    // Позволяет инициировать загрузку отложенных документов из обработчика
    // кнопки «Сохранить изменения» — без отдельной кнопки «Загрузить все».
    // Именно так работает режим редактирования программы: пользователь
    // выбирает документы, заполняет описание/тип и нажимает «Сохранить
    // изменения» — программа обновляется, а документы загружаются в рамках
    // той же операции.
    //
    // Возвращаемый UploadZeroInjuryPendingResult даёт родителю возможность
    // показать честное сообщение о результате загрузки.
    // ------------------------------------------------------------------
    useImperativeHandle(
        ref,
        () => ({
            uploadPending: uploadAll,
        }),
        [uploadAll]
    );

    // ------------------------------------------------------------------
    // Работа с существующими документами
    // ------------------------------------------------------------------
    const handleDownload = async (doc: ZeroInjuryDocumentDto) => {
        try {
            const blob = await safetyService.downloadZeroInjuryDocument(
                programId,
                doc.id
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(`Скачивание "${doc.fileName}" начато`);
        } catch (err) {
            console.error('Ошибка скачивания:', err);
            toast.error('Не удалось скачать документ');
        }
    };

    const handleDelete = async (docId: string, fileName: string) => {
        if (!confirm(`Удалить документ "${fileName}"?`)) return;
        try {
            await safetyService.deleteZeroInjuryDocument(programId, docId);
            setDocuments((prev) => prev.filter((d) => d.id !== docId));
            toast.success(`Документ "${fileName}" удалён`);
        } catch (err) {
            console.error('Ошибка удаления:', err);
            toast.error(`Не удалось удалить "${fileName}"`);
        }
    };

    // ------------------------------------------------------------------
    // Рендер
    // ------------------------------------------------------------------
    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Зона drag-and-drop */}
            {isEditable && (
                <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${isDragging
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/jpg,image/png,application/pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <div className="flex flex-col items-center justify-center py-5 px-4">
                        <FiUpload
                            className={`w-6 h-6 mb-2 ${isDragging ? 'text-green-500' : 'text-gray-400'
                                }`}
                        />
                        <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                            {isDragging
                                ? 'Отпустите файлы для загрузки'
                                : 'Перетащите или кликните для выбора'}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 text-center">
                            JPEG, PNG, PDF, DOC/DOCX, XLS/XLSX до 20 МБ
                        </p>
                    </div>
                </div>
            )}

            {/* Очередь загрузки. Реф на этот блок используется для автоскролла
                в зону видимости при старте uploadAll(). */}
            {queue.length > 0 && (
                <div ref={queueContainerRef} className="space-y-2">
                    {queue.map((item) => (
                        <div
                            key={item.id}
                            className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    {item.status === 'pending' && (
                                        <FiFile className="w-5 h-5 text-gray-500" />
                                    )}
                                    {item.status === 'uploading' && (
                                        <FiLoader className="w-5 h-5 text-blue-500 animate-spin" />
                                    )}
                                    {item.status === 'success' && (
                                        <FiCheck className="w-5 h-5 text-green-500" />
                                    )}
                                    {item.status === 'error' && (
                                        <FiAlertTriangle className="w-5 h-5 text-red-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                            {item.file.name}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatFileSize(item.file.size)}
                                        </span>
                                    </div>
                                    {item.status === 'pending' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                            {/*
                                              Селект типа документа.
                                              Особенности стиля:
                                                • `FIELD_BASE_CLASSES` — общий набор классов для полей ввода,
                                                  включая `dark:[color-scheme:dark]`, который нужен именно
                                                  для нативного <select>, чтобы браузер нарисовал стрелку и
                                                  выпадающий список в тёмной теме.
                                                • Явные стили для <option> — в некоторых браузерах
                                                  (Chrome, Edge) их можно стилизовать, и это предотвращает
                                                  светлые полосы в списке.
                                            */}
                                            <select
                                                value={item.documentType}
                                                onChange={(e) =>
                                                    updateDocumentType(
                                                        item.id,
                                                        e.target.value
                                                    )
                                                }
                                                className={FIELD_BASE_CLASSES}
                                            >
                                                {documentTypeOptions.map((opt) => (
                                                    <option
                                                        key={opt.value}
                                                        value={opt.value}
                                                        className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                                    >
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>

                                            {/*
                                              Поле описания документа.
                                              Использует тот же FIELD_BASE_CLASSES, чтобы быть визуально
                                              согласованным с селектом.
                                            */}
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) =>
                                                    updateDescription(
                                                        item.id,
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Описание (необязательно)"
                                                className={FIELD_BASE_CLASSES}
                                            />
                                        </div>
                                    )}
                                    {item.status === 'uploading' && (
                                        <div className="mt-2">
                                            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 transition-all duration-150"
                                                    style={{ width: `${item.progress}%` }}
                                                />
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Загрузка... {item.progress}%
                                            </div>
                                        </div>
                                    )}
                                    {item.status === 'error' && (
                                        <div className="text-xs text-red-500 mt-1">
                                            {item.error}
                                        </div>
                                    )}
                                    {item.status === 'success' && item.uploaded && (
                                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                            ✓ Загружено: {item.uploaded.fileName}
                                        </div>
                                    )}
                                </div>
                                {(item.status === 'pending' ||
                                    item.status === 'success' ||
                                    item.status === 'error') && (
                                        <button
                                            type="button"
                                            onClick={() => removeFromQueue(item.id)}
                                            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                            title="Убрать"
                                        >
                                            <FiX className="w-4 h-4 text-gray-400" />
                                        </button>
                                    )}
                            </div>
                        </div>
                    ))}
                    {queue.some((q) => q.status === 'pending') && (
                        hideUploadAllButton ? (
                            <div className="w-full py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                                Документы будут загружены при сохранении программы
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    // Возвращаемое значение здесь не используется:
                                    // кнопка «Загрузить все» — самостоятельное действие,
                                    // и результат загрузки уже показывается тостами
                                    // внутри uploadAll.
                                    void uploadAll();
                                }}
                                className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            >
                                <FiUpload className="w-4 h-4" />
                                Загрузить все (
                                {queue.filter((q) => q.status === 'pending').length})
                            </button>
                        )
                    )}
                </div>
            )}

            {/* Список уже загруженных документов */}
            {documents.length === 0 ? (
                <div className="text-center py-5 text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/30">
                    Нет прикреплённых документов. Загрузите приказ или распоряжение.
                </div>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className="group flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-all"
                        >
                            <div className="flex-shrink-0">
                                {getFileIcon(doc.contentType)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div
                                    className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate"
                                    title={doc.fileName}
                                >
                                    {doc.fileName}
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span>{formatFileSize(doc.size)}</span>
                                    <span>•</span>
                                    <span>{getDocumentTypeLabel(doc.documentType)}</span>
                                    <span>•</span>
                                    <span>{formatDate(doc.createdAt)}</span>
                                </div>
                                {doc.description && (
                                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                        {doc.description}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                                <button
                                    type="button"
                                    onClick={() => handleDownload(doc)}
                                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                                    title="Скачать"
                                >
                                    <FiDownload className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                </button>
                                {isEditable && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleDelete(doc.id, doc.fileName)
                                        }
                                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                                        title="Удалить"
                                    >
                                        <FiTrash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

ZeroInjuryDocumentsManager.displayName = 'ZeroInjuryDocumentsManager';

export default ZeroInjuryDocumentsManager;