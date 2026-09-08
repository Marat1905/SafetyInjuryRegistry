/**
 * Главный компонент приложения.
 * Управляет темой оформления (светлая/тёмная) и отображает глобальные уведомления.
 * Содержит кнопку переключения темы и основной компонент GreenCross.
 */
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { FiSun, FiMoon } from 'react-icons/fi';
import  GreenCross  from './pages/greenCross/GreenCrossPage';
import './index.css';

function App() {
    // Состояние темы: 'light' или 'dark'
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        // При инициализации читаем сохранённую тему из localStorage
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') return saved;
        // Если сохранённой нет, используем системные настройки
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    // Применяем класс `dark` к корневому элементу при изменении темы
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Переключение темы
    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <>
            {/* Глобальный контейнер для уведомлений (тостов) */}
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: theme === 'dark' ? '#1f2937' : '#fff',
                        color: theme === 'dark' ? '#f3f4f6' : '#1f2937',
                    },
                }}
            />

            {/* Кнопка переключения темы – абсолютное позиционирование, чтобы она была всегда под рукой */}
            <button
                onClick={toggleTheme}
                className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 transition-all hover:scale-110"
                aria-label="Переключить тему"
            >
                {theme === 'light' ? (
                    <FiMoon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                ) : (
                    <FiSun className="w-5 h-5 text-yellow-500" />
                )}
            </button>

            {/* Основное приложение */}
            <GreenCross />
        </>
    );
}

export default App;