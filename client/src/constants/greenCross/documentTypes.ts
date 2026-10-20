/**
 * Список типов документов программы «Ноль травм».
 * Используется в форме загрузки.
 */
export const documentTypeOptions = [
    { value: 'Order', label: 'Приказ / распоряжение' },
    { value: 'Act', label: 'Акт' },
    { value: 'Report', label: 'Отчёт' },
    { value: 'Other', label: 'Прочее' },
];

/**
 * Получить человекочитаемое название типа документа по его машинному значению.
 */
export const getDocumentTypeLabel = (value: string): string => {
    const found = documentTypeOptions.find((opt) => opt.value === value);
    return found ? found.label : value;
};