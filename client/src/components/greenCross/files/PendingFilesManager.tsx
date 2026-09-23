/**
 * Компонент для управления файлами, которые ещё не загружены на сервер (при создании новой травмы).
 * Позволяет выбрать файлы (drag & drop или клик), указать описание и удалить из очереди.
 */
import React, { useRef, useState } from 'react';
import { FiUpload, FiX, FiImage, FiFileText, FiFile } from 'react-icons/fi';

interface PendingFile {
    id: string;
    file: File;
    description: string;
}

interface PendingFilesManagerProps {
    pendingFiles: PendingFile[];
    onAddFiles: (files: File[]) => void;
    onRemoveFile: (id: string) => void;
    onUpdateDescription: (id: string, description: string) => void;
}

const PendingFilesManager: React.FC<PendingFilesManagerProps> = ({
    pendingFiles,
    onAddFiles,
    onRemoveFile,
    onUpdateDescription,
}) => {
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
                                <div className="flex-shrink-0 mt-0.5">{getFileIcon(item.file.type)}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.file.name}</span>
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

export default PendingFilesManager;