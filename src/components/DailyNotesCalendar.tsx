import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DailyNotesCalendarProps {
    onDateSelect: (date: string) => void; // YYYY-MM-DD format
    existingNoteDates: Set<string>; // Set of dates with notes
    onClose: () => void;
}

export function DailyNotesCalendar({ onDateSelect, existingNoteDates, onClose }: DailyNotesCalendarProps) {
    const today = new Date();
    const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Get month name
    const monthName = viewDate.toLocaleString('default', { month: 'long' });

    // Calculate calendar grid
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Generate calendar days
    const days: Array<{ date: number; isCurrentMonth: boolean; dateString: string }> = [];

    // Previous month overflow
    for (let i = firstDay - 1; i >= 0; i--) {
        const date = daysInPrevMonth - i;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        days.push({
            date,
            isCurrentMonth: false,
            dateString: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
        });
    }

    // Current month
    for (let date = 1; date <= daysInMonth; date++) {
        days.push({
            date,
            isCurrentMonth: true,
            dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
        });
    }

    // Next month overflow to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let date = 1; date <= remainingDays; date++) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        days.push({
            date,
            isCurrentMonth: false,
            dateString: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
        });
    }

    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    const handleDateClick = (dateString: string) => {
        onDateSelect(dateString);
        onClose();
    };

    const isToday = (dateString: string) => {
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return dateString === todayString;
    };

    const hasNote = (dateString: string) => {
        return existingNoteDates.has(dateString);
    };

    return (
        <div
            style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--sidebar-border)',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                width: '320px',
                userSelect: 'none'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <button
                    onClick={handlePrevMonth}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-primary)',
                        borderRadius: '4px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {monthName} {year}
                </span>

                <button
                    onClick={handleNextMonth}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-primary)',
                        borderRadius: '4px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div
                        key={day}
                        style={{
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            padding: '4px 0'
                        }}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {days.map((day, index) => {
                    const isTodayDate = isToday(day.dateString);
                    const hasNoteDate = hasNote(day.dateString);

                    return (
                        <button
                            key={index}
                            onClick={() => handleDateClick(day.dateString)}
                            style={{
                                padding: '8px',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                cursor: 'pointer',
                                backgroundColor: isTodayDate ? 'var(--primary-color)' : hasNoteDate && day.isCurrentMonth ? 'var(--hover-bg)' : 'transparent',
                                color: isTodayDate ? 'white' : day.isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontWeight: isTodayDate ? 600 : 400,
                                transition: 'background-color 0.2s',
                                position: 'relative'
                            }}
                            onMouseOver={(e) => {
                                if (!isTodayDate) {
                                    e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isTodayDate) {
                                    e.currentTarget.style.backgroundColor = hasNoteDate && day.isCurrentMonth ? 'var(--hover-bg)' : 'transparent';
                                }
                            }}
                        >
                            {day.date}
                            {hasNoteDate && day.isCurrentMonth && !isTodayDate && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '4px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '4px',
                                    height: '4px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--primary-color)'
                                }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
