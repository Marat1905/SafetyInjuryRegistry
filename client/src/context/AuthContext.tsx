/**
 * ТЕСТОВЫЙ AuthContext.
 * Не содержит реальной аутентификации: пользователь и его роли
 * подставляются из фиксированного набора TEST_USERS.
 *
 * Роль можно переключать в рантайме через cycleTestRole() / setTestRole().
 * Текущая роль сохраняется в localStorage (ключ 'test_role'),
 * чтобы переживать перезагрузку страницы.
 *
 * В продакшене замените этот файл на полноценный AuthContext
 * (с login/logout/refreshUser и обращением к authService).
 */
import React, {
    createContext,
    useContext,
    useState,
    useMemo,
    useCallback,
    type ReactNode,
} from 'react';

/** Доступные тестовые роли */
export type TestRole = 'User' | 'Safety' | 'Admin';

/** Упрощённая модель пользователя (совпадает с UserDto из прода) */
export interface UserDto {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    patronymic?: string;
    roles: string[];
}

interface AuthContextType {
    user: UserDto | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isSafety: boolean;
    isAdminOrSafety: boolean;

    /** Текущая тестовая роль ('User' | 'Safety' | 'Admin') */
    testRole: TestRole;
    /** Установить роль явно */
    setTestRole: (role: TestRole) => void;
    /** Переключить роль по кругу: User → Safety → Admin → User */
    cycleTestRole: () => void;
    /** Флаг загрузки — в тестовом режиме всегда false */
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
};

/** Предустановленные тестовые пользователи для каждой роли */
const TEST_USERS: Record<TestRole, UserDto> = {
    User: {
        id: 'test-user',
        username: 'user',
        firstName: 'Иван',
        lastName: 'Иванов',
        patronymic: 'Иванович',
        roles: ['User'],
    },
    Safety: {
        id: 'test-safety',
        username: 'safety',
        firstName: 'Пётр',
        lastName: 'Петров',
        patronymic: 'Петрович',
        roles: ['Safety'],
    },
    Admin: {
        id: 'test-admin',
        username: 'admin',
        firstName: 'Сидор',
        lastName: 'Сидоров',
        patronymic: 'Сидорович',
        roles: ['Admin'],
    },
};

/** Порядок переключения ролей по кнопке */
const ROLE_CYCLE: TestRole[] = ['User', 'Safety', 'Admin'];

/** Ключ в localStorage для сохранения выбранной роли */
const STORAGE_KEY = 'test_role';

/** Прочитать сохранённую роль, либо вернуть 'User' по умолчанию */
const readStoredRole = (): TestRole => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && (ROLE_CYCLE as string[]).includes(saved)
        ? (saved as TestRole)
        : 'User';
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    // Текущая роль хранится в состоянии — это и есть триггер ре-рендера
    const [testRole, setTestRoleState] = useState<TestRole>(readStoredRole);

    /** Явная установка роли */
    const setTestRole = useCallback((role: TestRole) => {
        localStorage.setItem(STORAGE_KEY, role);
        setTestRoleState(role);
    }, []);

    /** Переключение роли по кругу */
    const cycleTestRole = useCallback(() => {
        setTestRoleState((prev) => {
            const idx = ROLE_CYCLE.indexOf(prev);
            const next = ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length];
            localStorage.setItem(STORAGE_KEY, next);
            return next;
        });
    }, []);

    // Пользователь пересобирается при смене роли — ссылка на объект меняется,
    // поэтому все зависимые useMemo ниже пересчитываются корректно.
    const user = useMemo<UserDto | null>(() => TEST_USERS[testRole], [testRole]);

    // Вычисляемые флаги ролей — ровно как в продакшене
    const isAdmin = useMemo(() => user?.roles.includes('Admin') || false, [user]);
    const isSafety = useMemo(() => user?.roles.includes('Safety') || false, [user]);
    const isAdminOrSafety = useMemo(() => isAdmin || isSafety, [isAdmin, isSafety]);

    const value: AuthContextType = {
        user,
        isAuthenticated: true,
        isAdmin,
        isSafety,
        isAdminOrSafety,
        testRole,
        setTestRole,
        cycleTestRole,
        loading: false,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};