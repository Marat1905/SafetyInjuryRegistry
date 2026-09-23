/**
 * Экспорт всех компонентов модуля Green Cross для удобного импорта.
 */

// Отображение (в корне)
export { default as StatsPanel } from './StatsPanel';
export { default as LegendPanel } from './LegendPanel';

// Основные компоненты со своими подпапками
export * from './CrossCalendar';
export * from './YearCalendarView';
export * from './forms';
export * from './files';
export * from './modals';

// Реэкспорт MonthView для обратной совместимости: раньше он экспортировался
// из barrel как именованный экспорт (`export { default as MonthView }`),
// теперь живёт внутри YearCalendarView, но также доступен через barrel
// YearCalendarView/index.ts, а значит — и через этот barrel.