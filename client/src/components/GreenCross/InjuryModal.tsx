/**
 * Модальное окно для просмотра, создания и редактирования травмы.
 * Содержит в себе формы и управление файлами.
 * Режим определяется наличием selectedInjury и ролью пользователя.
 */
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FiX, FiPlus, FiActivity, FiPaperclip, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { safetyService } from '../../services/greenCross/api';
import type { InjuryDto, CreateInjuryRequest, UpdateInjuryRequest } from '../../types/greenCross';
import CreateEditInjuryForm from './CreateEditInjuryForm';
import PendingFilesManager from './PendingFilesManager';
import InjuryFilesManager from './InjuryFilesManager';

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

    // Определяем режим при открытии
    useEffect(() => {
        if (selectedInjury) {
            setMode(isSafetyEngineer ? 'edit' : 'view');
        } else {
            setMode('create');
        }
    }, [selectedInjury, isSafetyEngineer]);

    // Сброс состояния при закрытии
    const handleClose = () => {
        setPendingFiles([]);
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

    // Создание травмы (вызывается из формы)
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

            // Загружаем файлы, если есть
            if (pendingFiles.length > 0) {
                const uploadPromises = pendingFiles.map(async (pending) => {
                    try {
                        await safetyService.uploadFile(newInjury.id, pending.file, pending.description || undefined);
                        toast.success(`Файл "${pending.file.name}" загружен`);
                    } catch (err) {
                        console.error(err);
                        toast.error(`Ошибка загрузки файла "${pending.file.name}"`);
                    }
                });
                await Promise.allSettled(uploadPromises);
            }

            toast.success('Запись о травме успешно создана');
            onInjuryChanged();
            handleClose();
        } catch (error) {
            console.error(error);
            toast.error('Не удалось создать травму');
        } finally {
            setCreating(false);
        }
    };

    // Обновление травмы
    const handleUpdate = async (data: UpdateInjuryRequest) => {
        if (!selectedInjury) return;
        setUpdating(true);
        try {
            const updated = await safetyService.update(selectedInjury.id, data);
            toast.success('Запись о травме обновлена');
            onInjuryChanged();
            handleClose();
        } catch (error) {
            console.error(error);
            toast.error('Не удалось обновить травму');
        } finally {
            setUpdating(false);
        }
    };

    // Удаление травмы
    const handleDelete = async () => {
        if (!selectedInjury) return;
        if (!confirm('Вы уверены, что хотите удалить эту травму? Это действие необратимо.')) return;
        try {
            await safetyService.delete(selectedInjury.id);
            toast.success('Запись о травме удалена');
            onInjuryChanged();
            handleClose();
        } catch (error) {
            console.error(error);
            toast.error('Не удалось удалить травму');
        }
    };

    // Рендер содержимого в зависимости от режима
    const renderContent = () => {
        if (mode === 'view' && selectedInjury) {
            return (
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата</label>
                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl">
                            {selectedDate ? format(selectedDate, 'dd.MM.yyyy') : ''}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Категория происшествия</label>
                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl">
                            {selectedInjury.category}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Тип происшествия</label>
                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl">
                            {selectedInjury.type}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                        <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl min-h-[160px] whitespace-pre-wrap">
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
                            <PendingFilesManager
                                pendingFiles={pendingFiles}
                                onAddFiles={addPendingFiles}
                                onRemoveFile={removePendingFile}
                                onUpdateDescription={updatePendingFileDescription}
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
                            <InjuryFilesManager injuryId={selectedInjury.id} isEditable={true} />
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
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Заголовок */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        {getIcon()} {getTitle()}
                    </h3>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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