/**
 * Компонент для управления файлами, прикреплёнными к травме.
 * Позволяет просматривать, скачивать, удалять существующие файлы,
 * а также загружать новые через drag-and-drop или выбор файла.
 * Поддерживает очередь загрузки с РЕАЛЬНЫМ прогрессом (через
 * axios onUploadProgress, см. safetyService.uploadFile).
 *
 * Компонент обёрнут в forwardRef и предоставляет наружу императивный
 * метод uploadPending(). Это нужно, чтобы родитель (InjuryModal) мог
 * инициировать загрузку отложенных файлов прямо из обработчика кнопки
 * «Сохранить» — без отдельной кнопки «Загрузить все».
 *
 * uploadPending() возвращает UploadPendingResult с количеством
 * запланированных и неудавшихся загрузок. Это позволяет родителю
 * показать честное сообщение: «травма сохранена и файлы загружены»,
 * «травма сохранена, но часть файлов не загрузилась» или
 * «травма сохранена без файлов».
 *
 * ВАЖНО про type="button".
 *
 * Компонент рендерится ВНУТРИ <form> (CreateEditInjuryForm). По умолчанию
 * <button> без атрибута type ведёт себя как type="submit" — то есть любой
 * клик по такой кнопке вызывает submit формы. Это приводило к тому, что
 * клик по кнопке удаления файла триггерил handleUpdate → PUT → закрытие
 * модалки, хотя пользователь всего лишь хотел удалить вложение.
 *
 * Поэтому КАЖДАЯ кнопка здесь явно помечена type="button". Внутри формы
 * единственная кнопка с type="submit" — это кнопка «Создать/Сохранить»
 * в CreateEditInjuryForm.
 */
import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
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
    FiCheck,
    FiAlertTriangle,
    FiLoader,
    FiPaperclip,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { safetyService } from '../../../services/greenCross/api';
import type { InjuryFileDto } from '../../../types/greenCross';

// ----------------------------------------------------------------------
// Константы валидации (должны совпадать с бэкендом UploadFileFormValidator)
// ----------------------------------------------------------------------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

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
    if (contentType.startsWith('image/')) return <FiImage className="w-5 h-5 text-blue-500" />;
    if (contentType === 'application/pdf') return <FiFileText className="w-5 h-5 text-red-500" />;
    return <FiFile className="w-5 h-5 text-gray-500" />;
};

// ----------------------------------------------------------------------
// Типы
// ----------------------------------------------------------------------
interface UploadingFile {
    id: string; // уникальный временный id
    file: File;
    description: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number; // 0-100
    error?: string;
    uploadedFile?: InjuryFileDto;
}

/**
 * Результат загрузки отложенных файлов.
 *
 * total  — сколько файлов было в очереди со статусом 'pending' на момент вызова.
 * failed — сколько из них не удалось загрузить (сервер вернул ошибку).
 *
 * Если total === 0, значит, загружать было нечего (пользователь не добавлял
 * файлов или все они уже загружены в предыдущих итерациях).
 */
export interface UploadPendingResult {
    total: number;
    failed: number;
}

/**
 * Императивный интерфейс компонента.
 *
 * Позволяет родителю (InjuryModal) запустить загрузку всех файлов,
 * находящихся в очереди со статусом 'pending', в момент сохранения травмы.
 * Ошибки загрузки отдельных файлов показываются через toast внутри
 * uploadAll и не пробрасываются наружу — промис всегда резолвится,
 * чтобы не ломать сценарий сохранения. Информация о неудачах приходит
 * через UploadPendingResult.
 */
export interface InjuryFilesManagerHandle {
    /**
     * Загрузить все файлы, находящиеся в очереди со статусом 'pending'.
     * Если очередь пуста — возвращает { total: 0, failed: 0 }.
     * Промис резолвится, когда все загрузки завершены (успешно или с ошибкой).
     */
    uploadPending: () => Promise<UploadPendingResult>;
}

interface InjuryFilesManagerProps {
    injuryId: string;
    isEditable: boolean;
    /**
     * Скрыть кнопку «Загрузить все».
     *
     * Используется в режиме редактирования травмы: там загрузка файлов
     * выполняется автоматически при нажатии «Сохранить» (см.
     * InjuryModal.handleUpdate). Вместо кнопки показывается подсказка
     * «Файлы будут загружены при сохранении травмы».
     */
    hideUploadAllButton?: boolean;
}

// ----------------------------------------------------------------------
// Компонент менеджера файлов – новая вёрстка: drag‑and‑drop слева, файлы справа
// ----------------------------------------------------------------------
const InjuryFilesManager = forwardRef<InjuryFilesManagerHandle, InjuryFilesManagerProps>(
    ({ injuryId, isEditable, hideUploadAllButton = false }, ref) => {
        const [files, setFiles] = useState<InjuryFileDto[]>([]);
        const [loading, setLoading] = useState<boolean>(false);
        const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
        const [isDragging, setIsDragging] = useState<boolean>(false);
        const [globalError, setGlobalError] = useState<string | null>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        // Ref на контейнер очереди. Нужен для автоскролла: когда пользователь
        // нажимает «Сохранить», очередь загрузки может быть ниже видимой области
        // модалки (она в overflow-y-auto). Скроллим её в зону видимости, чтобы
        // полосы прогресса были видны.
        const queueContainerRef = useRef<HTMLDivElement>(null);

        // Таймер очистки завершённых элементов очереди. Храним ссылку,
        // чтобы погасить его при размонтировании компонента: при сохранении
        // модалка закрывается сразу после загрузки файлов, и без clearTimeout
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
        // Загрузка списка файлов с сервера
        // ------------------------------------------------------------------
        const loadFiles = useCallback(async () => {
            if (!injuryId) return;
            setLoading(true);
            setGlobalError(null);
            try {
                const data = await safetyService.getFiles(injuryId);
                setFiles(data);
            } catch (err) {
                console.error('Ошибка загрузки файлов:', err);
                setGlobalError('Не удалось загрузить список файлов');
                toast.error('Не удалось загрузить список файлов');
            } finally {
                setLoading(false);
            }
        }, [injuryId]);

        useEffect(() => {
            loadFiles();
        }, [loadFiles]);

        // ------------------------------------------------------------------
        // Валидация файла (синхронизирована с бэкендом)
        // ------------------------------------------------------------------
        const validateFile = (file: File): { valid: boolean; error?: string } => {
            if (file.size > MAX_FILE_SIZE) {
                return { valid: false, error: `Размер файла "${file.name}" превышает 10 МБ` };
            }
            if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
                return { valid: false, error: `Тип файла "${file.name}" не поддерживается. Разрешены: JPEG, PNG, PDF` };
            }
            return { valid: true };
        };

        // ------------------------------------------------------------------
        // Добавление файлов в очередь
        // ------------------------------------------------------------------
        const addFilesToQueue = (selectedFiles: FileList | File[]) => {
            const newFiles: UploadingFile[] = [];
            for (const file of Array.from(selectedFiles)) {
                const { valid, error } = validateFile(file);
                if (!valid) {
                    toast.error(error);
                    continue;
                }
                newFiles.push({
                    id: `${Date.now()}-${Math.random()}-${file.name}`,
                    file,
                    description: '',
                    status: 'pending',
                    progress: 0,
                });
            }
            if (newFiles.length) {
                setUploadQueue((prev) => [...prev, ...newFiles]);
                toast.success(`Добавлено файлов: ${newFiles.length}`);
            }
        };

        // Обработчик выбора файлов через input
        const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) addFilesToQueue(e.target.files);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };

        // Drag & Drop handlers
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
            const files = e.dataTransfer.files;
            if (files.length) addFilesToQueue(files);
        };

        // ------------------------------------------------------------------
        // Управление очередью
        // ------------------------------------------------------------------
        const removeFromQueue = (id: string) => {
            setUploadQueue((prev) => prev.filter((item) => item.id !== id));
            toast('Файл удалён из очереди', { icon: '🗑️' });
        };

        const updateDescription = (id: string, description: string) => {
            setUploadQueue((prev) =>
                prev.map((item) => (item.id === id ? { ...item, description } : item))
            );
        };

        const clearQueue = () => {
            if (window.confirm('Отменить загрузку всех файлов?')) {
                setUploadQueue([]);
                toast('Очередь загрузки очищена', { icon: '🧹' });
            }
        };

        // Загрузка всех файлов из очереди (последовательно).
        //
        // Возвращает UploadPendingResult, чтобы вызывающая сторона могла
        // отличить три исхода:
        //   • total === 0            — загружать было нечего;
        //   • total > 0, failed === 0 — всё загружено;
        //   • total > 0, failed > 0   — часть файлов не загрузилась.
        //
        // Ошибки по отдельным файлам не пробрасываются наружу: это
        // осознанное решение, потому что один упавший файл не должен
        // отменять успешную загрузку остальных и не должен ломать
        // сценарий сохранения травмы в InjuryModal.
        //
        // Перед стартом очередь прокручивается в зону видимости: если
        // пользователь нажал «Сохранить» наверху формы, без скролла он
        // не увидит полосы прогресса.
        const uploadAll = async (): Promise<UploadPendingResult> => {
            const pendingItems = uploadQueue.filter((item) => item.status === 'pending');
            if (pendingItems.length === 0) {
                return { total: 0, failed: 0 };
            }

            // Прокручиваем очередь в зону видимости, чтобы пользователь
            // увидел прогресс-бары. behavior: 'smooth' — плавно, block: 'nearest' —
            // только если элемент вне видимой области (не дёргаем страницу зря).
            queueContainerRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });

            // Сначала устанавливаем статус uploading для всех, кто ещё не начался
            setUploadQueue((prev) =>
                prev.map((item) =>
                    item.status === 'pending' ? { ...item, status: 'uploading', progress: 0 } : item
                )
            );

            let failed = 0;

            for (const item of pendingItems) {
                try {
                    // Реальный прогресс: axios вызывает onUploadProgress
                    // по мере отправки байт, мы обновляем progress
                    // конкретного элемента очереди.
                    const uploadedFile = await safetyService.uploadFile(
                        injuryId,
                        item.file,
                        item.description.trim() || undefined,
                        (percent) => {
                            setUploadQueue((prev) =>
                                prev.map((q) =>
                                    q.id === item.id ? { ...q, progress: percent } : q
                                )
                            );
                        }
                    );
                    setUploadQueue((prev) =>
                        prev.map((q) =>
                            q.id === item.id
                                ? { ...q, status: 'success', progress: 100, uploadedFile }
                                : q
                        )
                    );
                    // Добавляем в основной список
                    setFiles((prev) => [...prev, uploadedFile]);
                    toast.success(`Файл "${item.file.name}" успешно загружен`);
                } catch (err) {
                    failed++;
                    console.error('Ошибка загрузки:', err);
                    setUploadQueue((prev) =>
                        prev.map((q) =>
                            q.id === item.id
                                ? { ...q, status: 'error', progress: 0, error: 'Ошибка загрузки' }
                                : q
                        )
                    );
                    toast.error(`Ошибка загрузки файла "${item.file.name}"`);
                }
            }

            // Через 3 секунды удаляем успешно загруженные и ошибочные из очереди.
            // Таймер сохраняем в ref, чтобы погасить его при размонтировании
            // (модалка закрывается сразу после сохранения).
            if (clearTimerRef.current) {
                clearTimeout(clearTimerRef.current);
            }
            clearTimerRef.current = setTimeout(() => {
                setUploadQueue((prev) => prev.filter((item) => item.status === 'pending'));
            }, 3000);

            return { total: pendingItems.length, failed };
        };

        // ------------------------------------------------------------------
        // Императивный API для родителя (InjuryModal).
        //
        // Позволяет инициировать загрузку отложенных файлов из обработчика
        // кнопки «Сохранить» — без отдельной кнопки «Загрузить все».
        // Именно так работает режим редактирования травмы: пользователь
        // выбирает файлы, заполняет описание и нажимает «Сохранить» —
        // травма обновляется, а файлы загружаются в рамках той же операции.
        //
        // Возвращаемый UploadPendingResult даёт родителю возможность
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
        // Действия с уже загруженными файлами
        // ------------------------------------------------------------------
        const handleDownload = async (file: InjuryFileDto) => {
            try {
                const blob = await safetyService.downloadFile(injuryId, file.id);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success(`Скачивание "${file.fileName}" начато`);
            } catch (err) {
                console.error('Ошибка скачивания:', err);
                toast.error('Не удалось скачать файл');
            }
        };

        const handleDelete = async (fileId: string, fileName: string) => {
            if (!confirm(`Удалить файл "${fileName}"?`)) return;
            try {
                await safetyService.deleteFile(injuryId, fileId);
                setFiles((prev) => prev.filter((f) => f.id !== fileId));
                toast.success(`Файл "${fileName}" удалён`);
            } catch (err) {
                console.error('Ошибка удаления:', err);
                toast.error(`Не удалось удалить файл "${fileName}"`);
            }
        };

        // ------------------------------------------------------------------
        // Рендер
        // ------------------------------------------------------------------
        if (loading) {
            return (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent" />
                </div>
            );
        }

        if (globalError) {
            return (
                <div className="text-center py-8 text-red-500 dark:text-red-400">
                    {globalError}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* ЛЕВАЯ КОЛОНКА: компактная зона drag-and-drop (только для редактирования) */}
                    {isEditable && (
                        <div className="md:w-1/3">
                            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 border border-dashed border-gray-300 dark:border-gray-600">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <FiUpload className="w-4 h-4" /> Добавить файлы
                                </h4>
                                <div
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                                        relative rounded-lg border-2 border-dashed transition-all cursor-pointer
                                        ${isDragging
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }
                                    `}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <div className="flex flex-col items-center justify-center py-6 px-3">
                                        <FiUpload className={`w-6 h-6 mb-2 ${isDragging ? 'text-green-500' : 'text-gray-400'}`} />
                                        <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                                            {isDragging ? 'Отпустите файлы' : 'Перетащите или кликните'}
                                        </p>
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 text-center">
                                            JPEG, PNG, PDF до 10 МБ
                                        </p>
                                    </div>
                                </div>
                                {/* Компактная информация о форматах */}
                                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">
                                    Макс. 10 МБ на файл
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ПРАВАЯ КОЛОНКА: список существующих файлов и очередь загрузки */}
                    <div className={isEditable ? "md:w-2/3" : "w-full"}>
                        {/* Заголовок с количеством файлов */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <FiPaperclip className="w-4 h-4" />
                                <span className="font-medium">Прикреплённые файлы</span>
                                {files.length > 0 && (
                                    <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                        {files.length}
                                    </span>
                                )}
                            </div>
                            {isEditable && files.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                                >
                                    <FiUpload className="w-3 h-3" /> Добавить
                                </button>
                            )}
                        </div>

                        {/* Список уже загруженных файлов */}
                        {files.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/30">
                                Нет прикреплённых файлов
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                                {files.map((file) => (
                                    <div
                                        key={file.id}
                                        className="group flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-all"
                                    >
                                        <div className="flex-shrink-0">{getFileIcon(file.contentType)}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={file.fileName}>
                                                {file.fileName}
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span>{formatFileSize(file.size)}</span>
                                                <span>•</span>
                                                <span>{formatDate(file.createdAt)}</span>
                                            </div>
                                            {file.description && (
                                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{file.description}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                                            <button
                                                type="button"
                                                onClick={() => handleDownload(file)}
                                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                                                title="Скачать"
                                            >
                                                <FiDownload className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                            </button>
                                            {isEditable && (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDelete(file.id, file.fileName)}
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

                        {/* Очередь на загрузку (отображается справа внизу).
                            Реф на этот блок используется для автоскролла
                            в зону видимости при старте uploadAll(). */}
                        {uploadQueue.length > 0 && (
                            <div ref={queueContainerRef} className="mt-4 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Ожидают загрузки ({uploadQueue.filter((f) => f.status === 'pending').length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={clearQueue}
                                        className="text-xs text-red-500 hover:underline flex items-center gap-1"
                                    >
                                        <FiX className="w-3 h-3" /> Очистить все
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {uploadQueue.map((item) => (
                                        <div
                                            key={item.id}
                                            className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    {item.status === 'pending' && <FiFile className="w-5 h-5 text-gray-500" />}
                                                    {item.status === 'uploading' && <FiLoader className="w-5 h-5 text-blue-500 animate-spin" />}
                                                    {item.status === 'success' && <FiCheck className="w-5 h-5 text-green-500" />}
                                                    {item.status === 'error' && <FiAlertTriangle className="w-5 h-5 text-red-500" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                            {item.file.name}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{formatFileSize(item.file.size)}</span>
                                                    </div>
                                                    {item.status === 'pending' && (
                                                        <>
                                                            <input
                                                                type="text"
                                                                value={item.description}
                                                                onChange={(e) => updateDescription(item.id, e.target.value)}
                                                                placeholder="Описание (необязательно)"
                                                                className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-1 focus:ring-green-500"
                                                            />
                                                            <div className="flex justify-end mt-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeFromQueue(item.id)}
                                                                    className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
                                                                >
                                                                    <FiX className="w-3 h-3" /> Удалить
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                    {item.status === 'uploading' && (
                                                        <div className="mt-2">
                                                            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-green-500 transition-all duration-150"
                                                                    style={{ width: `${item.progress}%` }}
                                                                />
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                Загрузка... {item.progress}%
                                                            </div>
                                                        </div>
                                                    )}
                                                    {item.status === 'error' && (
                                                        <div className="text-xs text-red-500 mt-1">{item.error}</div>
                                                    )}
                                                    {item.status === 'success' && item.uploadedFile && (
                                                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                            ✓ Загружено: {item.uploadedFile.fileName}
                                                        </div>
                                                    )}
                                                </div>
                                                {(item.status === 'success' || item.status === 'error') && (
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
                                </div>
                                {uploadQueue.some((f) => f.status === 'pending') && (
                                    hideUploadAllButton ? (
                                        <div className="w-full mt-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                                            Файлы будут загружены при сохранении травмы
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Возвращаемое значение здесь не используется:
                                                // кнопка «Загрузить все» — самостоятельное действие,
                                                // и результат загрузки уже показывается тостами внутри uploadAll.
                                                void uploadAll();
                                            }}
                                            className="w-full mt-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                        >
                                            <FiUpload className="w-4 h-4" />
                                            Загрузить все ({uploadQueue.filter((f) => f.status === 'pending').length})
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
);

InjuryFilesManager.displayName = 'InjuryFilesManager';

export default InjuryFilesManager;