/**
 * Компонент для управления документами программы «Ноль травм», которые ещё
 * не загружены на сервер (используется в режиме СОЗДАНИЯ программы).
 *
 * Прямой аналог PendingFilesManager для травм, но с дополнительным полем
 * documentType (Order / Act / Report / Other), потому что документы программы
 * типизированы, а файлы травм — нет.
 *
 * Поддерживает РЕАЛЬНЫЙ прогресс загрузки: родитель (ZeroInjuryModal)
 * передаёт uploadStates — карту id документа → { status, progress, error }.
 * Пока идёт загрузка, для каждого документа показывается полоса прогресса
 * и статус-иконка. Поля описания, селект типа и кнопка удаления при этом
 * блокируются, чтобы не сломать состояние во время отправки.
 *
 * ВАЖНО про type="button".
 *
 * Компонент рендерится ВНУТРИ <form> (форма создания программы). Все кнопки
 * здесь помечены type="button", чтобы клик по ним не вызывал submit формы
 * и не приводил к преждевременному созданию программы или закрытию модалки.
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
import {
    documentTypeOptions,
} from '../../../constants/greenCross/documentTypes';

// ----------------------------------------------------------------------
// Константы валидации (должны совпадать с бэкендом
// UploadZeroInjuryDocumentFormValidator)
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

/**
 * Документ, ожидающий загрузки.
 */
export interface PendingDocument {
    id: string;
    file: File;
    description: string;
    documentType: string;
}

/**
 * Статус загрузки одного документа.
 *
 * idle      — документ в очереди, загрузка ещё не начиналась;
 * uploading — идёт отправка, progress содержит процент (0-100);
 * success   — документ успешно загружен;
 * error     — загрузка завершилась ошибкой (error содержит текст).
 */
export type PendingDocumentUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface PendingDocumentUploadState {
    status: PendingDocumentUploadStatus;
    progress: number; // 0-100
    error?: string;
}

interface PendingZeroInjuryDocumentsManagerProps {
    pendingDocuments: PendingDocument[];
    onAddDocuments: (files: File[]) => void;
    onRemoveDocument: (id: string) => void;
    onUpdateDescription: (id: string, description: string) => void;
    onUpdateDocumentType: (id: string, documentType: string) => void;
    /**
     * Карта состояний загрузки: id документа → { status, progress, error }.
     * Если для документа нет записи — он считается в состоянии 'idle'
     * (только что добавлен в очередь, загрузка не начиналась).
     */
    uploadStates?: Map<string, PendingDocumentUploadState>;
    /**
     * true, если идёт создание программы (submitting).
     * Блокирует добавление новых документов, редактирование описаний,
     * смену типа и удаление из очереди.
     */
    disabled?: boolean;
}

// ----------------------------------------------------------------------
// Общие CSS-классы для полей ввода — согласованы с ZeroInjuryDocumentsManager.
// ----------------------------------------------------------------------
const FIELD_BASE_CLASSES =
    'w-full px-2 py-1 text-xs border rounded-lg ' +
    'bg-gray-50 dark:bg-gray-700 ' +
    'border-gray-300 dark:border-gray-600 ' +
    'text-gray-800 dark:text-gray-100 ' +
    'placeholder-gray-400 dark:placeholder-gray-500 ' +
    'focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent ' +
    'dark:[color-scheme:dark]';

const PendingZeroInjuryDocumentsManager: React.FC<PendingZeroInjuryDocumentsManagerProps> = ({
    pendingDocuments,
    onAddDocuments,
    onRemoveDocument,
    onUpdateDescription,
    onUpdateDocumentType,
    uploadStates,
    disabled = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        if (e.target.files) {
            onAddDocuments(Array.from(e.target.files));
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
        if (files.length) onAddDocuments(Array.from(files));
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
     * Возвращает состояние загрузки для документа.
     * Если в карте нет записи — значит, документ ещё в очереди ('idle').
     */
    const getUploadState = (id: string): PendingDocumentUploadState => {
        return uploadStates?.get(id) ?? { status: 'idle', progress: 0 };
    };

    return (
        <div className="space-y-4">
            {/* Drag & Drop область. Во время загрузки disabled — 
                клик и drop игнорируются, чтобы не добавлять новые документы 
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
                    accept="image/jpeg,image/jpg,image/png,application/pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={disabled}
                />
                <div className="flex flex-col items-center justify-center py-5 px-4">
                    <FiUpload
                        className={`w-7 h-7 mb-2 ${disabled
                                ? 'text-gray-300 dark:text-gray-600'
                                : isDragging
                                    ? 'text-green-500'
                                    : 'text-gray-400'
                            }`}
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                        {disabled
                            ? 'Идёт создание и загрузка...'
                            : isDragging
                                ? 'Отпустите файлы для загрузки'
                                : 'Перетащите документы или кликните для выбора'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
                        JPEG, PNG, PDF, DOC/DOCX, XLS/XLSX до 20 МБ
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 text-center">
                        Тип документа по умолчанию — «Прочее», измените при необходимости
                    </p>
                </div>
            </div>

            {/* Список выбранных документов. Для каждого документа, если он
                загружается или уже загружен/упал, показывается статус-иконка,
                полоса реального прогресса и результат. */}
            {pendingDocuments.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                    {pendingDocuments.map((item) => {
                        const state = getUploadState(item.id);
                        const isUploading = state.status === 'uploading';
                        const isSuccess = state.status === 'success';
                        const isError = state.status === 'error';
                        const isIdle = state.status === 'idle';

                        // Поля редактирования (селект типа + инпут описания)
                        // показываем всегда, кроме случая error — там уже
                        // показываем сообщение об ошибке. Во время uploading
                        // и success поля disabled.
                        const fieldsDisabled =
                            disabled || isUploading || isSuccess;

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

                                        {/* Селект типа документа и поле описания.
                                            Сетка 1/2 на sm и 2/2 на больших экранах —
                                            как в ZeroInjuryDocumentsManager. */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                            <select
                                                value={item.documentType}
                                                onChange={(e) =>
                                                    onUpdateDocumentType(
                                                        item.id,
                                                        e.target.value
                                                    )
                                                }
                                                className={FIELD_BASE_CLASSES}
                                                disabled={fieldsDisabled}
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
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) =>
                                                    onUpdateDescription(
                                                        item.id,
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Описание (необязательно)"
                                                className={FIELD_BASE_CLASSES}
                                                disabled={fieldsDisabled}
                                            />
                                        </div>

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
                                    {/* Кнопка удаления. Скрываем, если документ
                                        уже загружается или загружен —
                                        удалять из очереди бессмысленно.
                                        Явный type="button": кнопка внутри формы,
                                        без него клик вызовет submit формы. */}
                                    {!disabled && isIdle && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveDocument(item.id)}
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

export default PendingZeroInjuryDocumentsManager;