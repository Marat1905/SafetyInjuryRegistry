/**
 * Форма создания/редактирования травмы.
 * Содержит левую колонку с полями: дата (только чтение), категория, тип, описание.
 * Правая колонка (children) рендерится снаружи и передаётся сюда для отображения менеджера файлов.
 */
import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import { createInjurySchema, updateInjurySchema, type CreateInjuryFormData, type UpdateInjuryFormData } from '../../schemas/validationSchemas';
import { categoryOptions } from '../../constants/categories';

interface CreateEditInjuryFormProps {
    mode: 'create' | 'edit';
    selectedDate: Date | null;
    initialValues: CreateInjuryFormData | UpdateInjuryFormData;
    onSubmit: (data: any) => Promise<void>;
    isSubmitting: boolean;
    onDelete?: () => void;
    children?: React.ReactNode; // правая колонка (файлы)
}

const CreateEditInjuryForm: React.FC<CreateEditInjuryFormProps> = ({
    mode,
    selectedDate,
    initialValues,
    onSubmit,
    isSubmitting,
    onDelete,
    children,
}) => {
    const schema = mode === 'create' ? createInjurySchema : updateInjurySchema;
    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<any>({
        resolver: zodResolver(schema),
        defaultValues: initialValues,
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col md:flex-row gap-6">
                {/* Левая колонка */}
                <div className="md:w-1/2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата</label>
                        <input
                            type="text"
                            value={selectedDate ? format(selectedDate, 'dd.MM.yyyy') : ''}
                            disabled
                            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Категория происшествия *</label>
                        <Controller
                            name="category"
                            control={control}
                            render={({ field }) => (
                                <select
                                    {...field}
                                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${errors.category ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                >
                                    <option value="">-- Выберите категорию --</option>
                                    {categoryOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            )}
                        />
                        {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category.message as string}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Тип происшествия</label>
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <input
                                    {...field}
                                    type="text"
                                    placeholder="Например, порез, ушиб"
                                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${errors.type ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                />
                            )}
                        />
                        {errors.type && <p className="mt-1 text-xs text-red-500">{errors.type.message as string}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                        <Controller
                            name="description"
                            control={control}
                            render={({ field }) => (
                                <textarea
                                    {...field}
                                    rows={8}
                                    placeholder="Подробное описание травмы (до 1000 символов)"
                                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${errors.description ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                />
                            )}
                        />
                        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message as string}</p>}
                    </div>
                </div>

                {/* Правая колонка (передаётся из родителя) */}
                {children}
            </div>

            {/* Кнопки действий */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                {mode === 'edit' && onDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex items-center space-x-2"
                    >
                        <FiTrash2 className="w-4 h-4" />
                        <span>Удалить</span>
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-xl transition-colors flex items-center space-x-2"
                >
                    {isSubmitting && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
                    <FiPlus className="w-4 h-4" />
                    <span>{isSubmitting ? (mode === 'create' ? 'Создание...' : 'Сохранение...') : mode === 'create' ? 'Создать' : 'Сохранить'}</span>
                </button>
            </div>
        </form>
    );
};

export default CreateEditInjuryForm;