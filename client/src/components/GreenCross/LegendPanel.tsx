/**
 * Панель легенды: пояснение цветовых обозначений дней.
 */
import React from 'react';

const LegendPanel: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Легенда</h3>
            <div className="space-y-2">
                <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 shadow-md" />
                    <span className="text-gray-600 dark:text-gray-300">Нет травм (прошедшие и сегодня)</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-400 to-red-600 shadow-md" />
                    <span className="text-gray-600 dark:text-gray-300">Травмы П1 или П2</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 shadow-md" />
                    <span className="text-gray-600 dark:text-gray-300">Травмы П3–П6</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-lg bg-gray-300 dark:bg-gray-600 shadow-md" />
                    <span className="text-gray-600 dark:text-gray-300">Будущие дни</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-lg border-2 border-blue-500 bg-transparent" />
                    <span className="text-gray-600 dark:text-gray-300">Сегодня</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Нажмите на день, чтобы увидеть информацию о травме или добавить запись (кроме будущих дней без травм).
                </div>
            </div>
        </div>
    );
};

export default LegendPanel;