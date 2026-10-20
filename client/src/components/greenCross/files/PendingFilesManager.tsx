/**
 * Компонент для управления файлами, которые ещё не загружены на сервер
 * (при создании новой травмы). Позволяет выбрать файлы (drag & drop
 * или клик), указать описание и удалить из очереди.
 *
 * Дополнительно поддерживает отображение РЕАЛЬНОГО прогресса загрузки:
 * родитель (InjuryModal) передаёт uploadStates — карту id файла →
 * { status, progress, error }. Пока идёт загрузка, для каждого файла
 * показывается полоса прогресса и статус-иконка. Поля описания и кнопки
 * удаления при этом блокируются (disabled), чтобы не сломать состояние
 * во время отправки.
 *
 * ВАЖНО про type="button".
 *
 * Компонент рендерится ВНУТРИ <form> (CreateEditInjuryForm). Все кнопки
 * здесь помечены type="button", чтобы клик по ним не вызывал submit
 * формы и, как следствие, не приводил к преждевременному закрытию
 * модалки.
 */
import React, { useRef, useState } from 'react';
import {
    FiUpload,
    FiX,
    FiImage,
    FiFileText,
    FiFile,
    FiLoader,
    FiCheck,
    FiAlertTriangle,
} from 'react-icons/fi';

interface PendingFile {
    id: string;
    file: File;
    description: string;
}

/**
 * Статус загрузки одного файла.
 *
 * idle      — файл в очереди, загрузка ещё не начиналась;
 * uploading — идёт отправка, progress содержит процент (0-100);
 * success   — файл успешно загружен;
 * error     — загрузка завершилась ошибкой (error содержит текст).
 */
export type PendingFileUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface PendingFileUploadState {
    status: PendingFileUploadStatus;
    progress: number; // 0-100
    error?: string;
}

interface PendingFilesManagerProps {
    pendingFiles: PendingFile[];
    onAddFiles: (files: File[]) => void;
    onRemoveFile: (id: string) => void;
    onUpdateDescription: (id: string, description: string) => void;
    /**
     * Карта состояний загрузки: id файла → { status, progress, error }.
     * Если для файла нет записи — он считается в состоянии 'idle'
     * (только что добавлен в очередь, загрузка не начиналась).
     */
    uploadStates?: Map<string, PendingFileUploadState>;
    /**
     * true, если идёт загрузка хотя бы одного файла.
     * Блокирует добавление новых файлов, редактирование описаний
     * и удаление из очереди.
     */
    disabled?: boolean;
}

// ----------------------------------------------------------------------
// Общие CSS-классы для полей ввода. Полностью согласованы с классами
// в ZeroInjuryDocumentsManager, чтобы обе формы выглядели одинаково.
// ----------------------------------------------------------------------
const FIELD_BASE_CLASSES =
    'mt-1 w-full px-2 py-1 text-xs border rounded-lg ' +
    'bg-gray-50 dark:bg-gray-700 ' +
    'border-gray-300 dark:border-gray-600 ' +
    'text-gray-800 dark:text-gray-100 ' +
    'placeholder-gray-400 dark:placeholder-gray-500 ' +
    'focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent ' +
    'dark:[color-scheme:dark]';

const PendingFilesManager: React.FC<PendingFilesManagerProps> = ({
    pendingFiles,
    onAddFiles,
    onRemoveFile,
    onUpdateDescription,
    uploadStates,
    disabled = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        if (e.target.files) {
            onAddFiles(Array.from(e.target.files));
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
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
        if (disabled) return;
        const files = e.dataTransfer.files;
        if (files.length) onAddFiles(Array.from(files));
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    };

    const getFileIcon = (contentType: string) => {
        if (contentType.startsWith('image/'))
            return <FiImage className="w-5 h-5 text-blue-500" />;
        if (contentType === 'application/pdf')
            return <FiFileText className="w-5 h-5 text-red-500" />;
        return <FiFile className="w-5 h-5 text-gray-500" />;
    };

    /**
     * Возвращает состояние загрузки для файла.
     * Если в карте нет записи — значит, файл ещё в очереди ('idle').
     */
    const getUploadState = (id: string): PendingFileUploadState => {
        return uploadStates?.get(id) ?? { status: 'idle', progress: 0 };
    };

    return (
        <div className="space-y-4">
            {/* Drag & Drop область. Во время загрузки disabled — 
                клик и drop игнорируются, чтобы не добавлять новые файлы 
                в уже запущенный процесс. */}
            <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => {
                    if (!disabled) fileInputRef.current?.click();
                }}
                className={`relative rounded-xl border-2 border-dashed transition-all ${disabled
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/20 cursor-not-allowed opacity-60'
                        : isDragging
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 cursor-pointer'
                            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer'
                    }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={disabled}
                />
                <div className="flex flex-col items-center justify-center py-6 px-4">
                    <FiUpload
                        className={`w-8 h-8 mb-2 ${disabled
                                ? 'text-gray-300 dark:text-gray-600'
                                : isDragging
                                    ? 'text-green-500'
                                    : 'text-gray-400'
                            }`}
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                        {disabled
                            ? 'Идёт загрузка файлов...'
                            : isDragging
                                ? 'Отпустите файлы для загрузки'
                                : 'Перетащите файлы сюда или кликните для выбора'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        JPEG, PNG, PDF до 10 МБ (можно несколько)
                    </p>
                </div>
            </div>

            {/* Список выбранных файлов. Для каждого файла, если он загружается
                или уже загружен/упал, показывается статус-иконка, полоса
                реального прогресса и результат. */}
            {pendingFiles.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {pendingFiles.map((item) => {
                        const state = getUploadState(item.id);
                        const isUploading = state.status === 'uploading';
                        const isSuccess = state.status === 'success';
                        const isError = state.status === 'error';
                        const isIdle = state.status === 'idle';

                        return (
                            <div
                                key={item.id}
                                className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {isIdle && getFileIcon(item.file.type)}
                                        {isUploading && (
                                            <FiLoader className="w-5 h-5 text-blue-500 animate-spin" />
                                        )}
                                        {isSuccess && (
                                            <FiCheck className="w-5 h-5 text-green-500" />
                                        )}
                                        {isError && (
                                            <FiAlertTriangle className="w-5 h-5 text-red-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                {item.file.name}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatFileSize(item.file.size)}
                                            </span>
                                        </div>

                                        {/* Поле описания. Во время загрузки
                                            disabled, чтобы пользователь не менял
                                            данные, которые уже отправлены. */}
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={(e) =>
                                                onUpdateDescription(item.id, e.target.value)
                                            }
                                            placeholder="Описание (необязательно)"
                                            className={FIELD_BASE_CLASSES}
                                            disabled={disabled || isUploading || isSuccess}
                                        />

                                        {/* Полоса реального прогресса. */}
                                        {isUploading && (
                                            <div className="mt-2">
                                                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500 transition-all duration-150"
                                                        style={{ width: `${state.progress}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    Загрузка... {state.progress}%
                                                </div>
                                            </div>
                                        )}

                                        {/* Результат загрузки. */}
                                        {isSuccess && (
                                            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                ✓ Загружено
                                            </div>
                                        )}
                                        {isError && (
                                            <div className="text-xs text-red-500 mt-1">
                                                {state.error || 'Ошибка загрузки'}
                                            </div>
                                        )}
                                    </div>
                                    {/* Кнопка удаления. Скрываем, если файл
                                        уже загружается или загружен —
                                        удалять из очереди бессмысленно.
                                        Явный type="button": кнопка внутри формы,
                                        без него клик вызовет submit формы. */}
                                    {!disabled && isIdle && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveFile(item.id)}
                                            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                            title="Удалить"
                                        >
                                            <FiX className="w-4 h-4 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PendingFilesManager;