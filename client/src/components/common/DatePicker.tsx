import React, { useState, useRef, useLayoutEffect } from "react";
import { FiCalendar } from "react-icons/fi";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

interface DatePickerProps {
    date: Date;
    onChange: (date: Date) => void;
    /** Минимальная доступная дата (по умолчанию — без ограничения) */
    minDate?: Date;
    /** Максимальная доступная дата (по умолчанию — сегодня) */
    maxDate?: Date;
    /** Размер кнопки: 'sm' (py-1.5), 'md' (py-2, по умолчанию), 'lg' (py-2.5) */
    size?: 'sm' | 'md' | 'lg';
    /** Placeholder при пустом значении */
    placeholder?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
    date,
    onChange,
    minDate,
    maxDate,
    size = 'md',
    placeholder = "Выберите дату",
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(date);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Инициализируем позицию по умолчанию (левая привязка)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ left: 0 });

    // Синхронное вычисление позиции при открытии
    useLayoutEffect(() => {
        if (!isOpen) {
            setDropdownStyle({ left: 0 });
            return;
        }

        const buttonEl = buttonRef.current;
        const dropdownEl = dropdownRef.current;
        if (!buttonEl || !dropdownEl) return;

        const buttonRect = buttonEl.getBoundingClientRect();
        const dropdownWidth = dropdownEl.offsetWidth || 300;
        const viewportWidth = window.innerWidth;
        const spaceLeft = buttonRect.left;
        const spaceRight = viewportWidth - buttonRect.right;

        let newStyle: React.CSSProperties = {};

        if (spaceRight > spaceLeft && spaceRight > dropdownWidth) {
            newStyle = { left: 0 };
        } else if (spaceLeft > dropdownWidth) {
            newStyle = { right: 0 };
        } else {
            const leftOffset = Math.max(0, buttonRect.left - 20);
            newStyle = { left: leftOffset };
        }

        setDropdownStyle(newStyle);
    }, [isOpen]);

    // Синхронизируем внутреннее состояние с внешней датой при открытии
    useLayoutEffect(() => {
        if (isOpen) {
            setSelectedDate(date);
        }
    }, [isOpen, date]);

    const handleApply = () => {
        onChange(selectedDate);
        setIsOpen(false);
    };

    const handleCancel = () => {
        setSelectedDate(date);
        setIsOpen(false);
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
    };

    const formatDateDisplay = () => {
        if (!date) return placeholder;
        return format(date, "dd.MM.yyyy");
    };

    // Определяем классы для кнопки в зависимости от размера
    const getButtonPaddingClasses = () => {
        switch (size) {
            case 'sm':
                return 'px-3 py-1.5 text-sm';
            case 'lg':
                return 'px-3 py-2.5 text-base';
            default:
                return 'px-3 py-2 text-sm';
        }
    };

    const effectiveMaxDate = maxDate ?? new Date();

    return (
        <div className="relative w-full">
            <button
                ref={buttonRef}
                type="button"
                className={`border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 flex items-center justify-between w-full ${getButtonPaddingClasses()}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{formatDateDisplay()}</span>
                <FiCalendar className="ml-2 text-gray-500 dark:text-gray-400" />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-w-[95vw] w-auto min-w-[300px]"
                        style={dropdownStyle}
                    >
                        <div className="p-2">
                            <Calendar
                                date={selectedDate}
                                onChange={handleDateSelect}
                                minDate={minDate}
                                maxDate={effectiveMaxDate}
                                locale={ru}
                                dateDisplayFormat="dd.MM.yyyy"
                                color="#3b82f6"
                                showDateDisplay={false}
                                className="date-picker-calendar"
                            />
                        </div>

                        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {selectedDate && (
                                    <>
                                        Выбрано:{" "}
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            {format(selectedDate, "dd.MM.yyyy")}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="
                    px-6 py-3 rounded-xl
                    font-medium text-gray-600 dark:text-gray-400
                    hover:text-gray-900 dark:hover:text-gray-200
                    hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-100/50 dark:hover:from-gray-700 dark:hover:to-gray-700/50
                    transition-all duration-200
                  "
                                >
                                    Отмена
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    className="
                    px-6 py-3 rounded-xl
                    bg-gradient-to-r from-blue-500 to-blue-600
                    text-white font-semibold
                    hover:from-blue-600 hover:to-blue-700
                    transition-all duration-200
                    shadow-lg hover:shadow-xl hover:shadow-blue-500/30
                    transform hover:-translate-y-0.5
                  "
                                >
                                    Применить
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default React.memo(DatePicker);