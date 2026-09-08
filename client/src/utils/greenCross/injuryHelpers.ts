/**
 * Вспомогательные функции для работы с категориями травм.
 */

/**
 * Определяет, относится ли категория к значимым (П1/П2)
 * @param category - категория травмы (например, "Fatality", "LostWorkdayCase")
 * @returns true, если категория значимая, иначе false
 */
export const isSignificantCategory = (category: string): boolean => {
    const significant = ['Fatality', 'LostWorkdayCase', 'П1', 'П2'];
    return significant.includes(category);
};

/**
 * Возвращает CSS-класс для фона ячейки в зависимости от наличия травмы и её категории
 * @param category - категория травмы
 * @param hasInjury - есть ли травма в этот день
 * @returns строка с CSS-классами для градиентного фона
 */
export const getCategoryColorClass = (category: string, hasInjury: boolean): string => {
    if (!hasInjury) {
        return 'bg-gradient-to-br from-green-400 to-emerald-600 dark:from-green-600 dark:to-emerald-800';
    }
    if (isSignificantCategory(category)) {
        return 'bg-gradient-to-br from-red-400 to-red-600 dark:from-red-600 dark:to-red-800 shadow-md shadow-red-200/50 dark:shadow-red-900/30';
    }
    return 'bg-gradient-to-br from-yellow-400 to-amber-600 dark:from-yellow-600 dark:to-amber-800 shadow-md shadow-yellow-200/50 dark:shadow-yellow-900/30';
};