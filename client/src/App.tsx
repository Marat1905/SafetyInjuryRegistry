/**
 * Главный компонент приложения.
 * Управляет темой оформления (светлая/тёмная) и отображает глобальные уведомления.
 * Содержит две кнопки в правом верхнем углу:
 *   • переключение тестовой роли (User / Safety / Admin);
 *   • переключение темы.
 * Также оборачивает приложение в AuthProvider (тестовый).
 */
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { FiSun, FiMoon, FiUser, FiShield, FiUserCheck } from 'react-icons/fi';
import GreenCross from './pages/greenCross/GreenCrossPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

/** Иконка для текущей тестовой роли */
const RoleIcon: React.FC<{ role: string }> = ({ role }) => {
    if (role === 'Admin') return <FiShield className="w-5 h-5" />;
    if (role === 'Safety') return <FiUserCheck className="w-5 h-5" />;
    return <FiUser className="w-5 h-5" />;
};

/**
 * Внутренний компонент — внутри AuthProvider,
 * поэтому может использовать useAuth().
 */
const AppInner: React.FC = () => {
    // Состояние темы: 'light' или 'dark'
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') return saved;
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

    // Текущая тестовая роль и функция её переключения
    const { testRole, cycleTestRole } = useAuth();

    // Подписи и цвета для кнопки роли
    const roleLabel =
        testRole === 'Admin' ? 'Админ' :
            testRole === 'Safety' ? 'Инженер ТБ' :
                'Пользователь';

    const roleColor =
        testRole === 'Admin'
            ? 'text-purple-600 dark:text-purple-400'
            : testRole === 'Safety'
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-700 dark:text-gray-200';

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

            {/* Панель кнопок в правом верхнем углу: роль + тема */}
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
                {/* Кнопка смены тестовой роли (User → Safety → Admin → User) */}
                <button
                    onClick={cycleTestRole}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 transition-all hover:scale-105"
                    aria-label="Переключить тестовую роль"
                    title={`Тестовая роль: ${roleLabel} (клик — следующая)`}
                >
                    <span className={roleColor}>
                        <RoleIcon role={testRole} />
                    </span>
                    <span className={`text-xs font-medium ${roleColor}`}>{roleLabel}</span>
                </button>

                {/* Кнопка переключения темы */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 transition-all hover:scale-110"
                    aria-label="Переключить тему"
                >
                    {theme === 'light' ? (
                        <FiMoon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                    ) : (
                        <FiSun className="w-5 h-5 text-yellow-500" />
                    )}
                </button>
            </div>

            {/* Основное приложение */}
            <GreenCross />
        </>
    );
};

/** Обёртка с AuthProvider — здесь и только здесь создаётся контекст */
function App() {
    return (
        <AuthProvider>
            <AppInner />
        </AuthProvider>
    );
}

export default App;