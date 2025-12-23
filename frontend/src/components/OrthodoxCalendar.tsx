import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
    ORTHODOX_EVENTS_2025,
    CalendarEvent,
    MAJOR_FASTS_LIST,
    MAJOR_FEASTS_LIST,
    getEthiopianDate,
    ETH_MONTHS_METADATA,
    toGeez
} from '../data/orthodoxEvents';

const OrthodoxCalendar: React.FC = () => {
    const { language } = useLanguage();

    // Help to format "YYYY-MM-DD" safely in local time
    const formatLocalDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Help to parse "YYYY-MM-DD" safely as local midnight
    const parseLocalISO = (iso: string) => {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    // Gregorian state
    const [currentGCDate, setCurrentGCDate] = useState(new Date());
    // Ethiopian state
    const [currentEthMonthIdx, setCurrentEthMonthIdx] = useState(12); // Start at Tahsas 2018 (Dec 2025)

    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysOfWeekTi = ['ሰን', 'ሰኑ', 'ሰሉ', 'ረቡ', 'ሓሙ', 'ዓር', 'ቀዳ'];

    // Sync states when language changes or on mount
    useEffect(() => {
        const today = new Date();
        const ethToday = getEthiopianDate(today);
        const mIdx = ETH_MONTHS_METADATA.findIndex(m => m.name === ethToday.month && m.year === ethToday.year);
        if (mIdx !== -1) setCurrentEthMonthIdx(mIdx);
        setCurrentGCDate(today);
    }, []);

    // --- Gregorian Logic ---
    const displayedGCYear = currentGCDate.getFullYear();
    const displayedGCMonth = currentGCDate.getMonth();

    const gcDaysInMonth = useMemo(() => {
        return new Date(displayedGCYear, displayedGCMonth + 1, 0).getDate();
    }, [displayedGCYear, displayedGCMonth]);

    const gcFirstDayOfMonth = useMemo(() => {
        return new Date(displayedGCYear, displayedGCMonth, 1).getDay();
    }, [displayedGCYear, displayedGCMonth]);

    // --- Ethiopian Logic ---
    const currentEthMonth = ETH_MONTHS_METADATA[currentEthMonthIdx];
    const ethFirstDayOfMonth = useMemo(() => {
        return parseLocalISO(currentEthMonth.startGC).getDay();
    }, [currentEthMonth, parseLocalISO]);

    const ethInfo = useMemo(() => {
        if (!selectedDate) return null;
        return getEthiopianDate(parseLocalISO(selectedDate));
    }, [selectedDate, parseLocalISO]);

    const selectedEvent = useMemo(() => {
        if (!selectedDate) return null;
        return ORTHODOX_EVENTS_2025.find(e => e.date === selectedDate);
    }, [selectedDate]);

    const prevMonth = () => {
        if (language === 'ti') {
            if (currentEthMonthIdx > 0) setCurrentEthMonthIdx(currentEthMonthIdx - 1);
        } else {
            setCurrentGCDate(new Date(displayedGCYear, displayedGCMonth - 1, 1));
        }
        setSelectedDate(null);
    };

    const nextMonth = () => {
        if (language === 'ti') {
            if (currentEthMonthIdx < ETH_MONTHS_METADATA.length - 1) setCurrentEthMonthIdx(currentEthMonthIdx + 1);
        } else {
            setCurrentGCDate(new Date(displayedGCYear, displayedGCMonth + 1, 1));
        }
        setSelectedDate(null);
    };

    const isToday = (dateStr: string) => {
        const todayStr = formatLocalDate(new Date());
        return dateStr === todayStr;
    };

    const handleDateClick = (dateStr: string) => {
        setSelectedDate(selectedDate === dateStr ? null : dateStr);
    };

    const renderGrid = () => {
        if (language === 'ti') {
            // ETHIOPIAN VIEW
            return (
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: ethFirstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square opacity-0"></div>
                    ))}
                    {Array.from({ length: currentEthMonth.days }).map((_, i) => {
                        const ethDay = i + 1;
                        const startGC = parseLocalISO(currentEthMonth.startGC);
                        const gcDate = new Date(startGC.getTime() + i * 24 * 60 * 60 * 1000);
                        const dateStr = formatLocalDate(gcDate);
                        const event = ORTHODOX_EVENTS_2025.find(e => e.date === dateStr);
                        const isSelected = selectedDate === dateStr;
                        const isCurrent = isToday(dateStr);

                        return (
                            <CalendarCell
                                key={dateStr}
                                dayPrimary={ethDay}
                                daySecondary={gcDate.getDate()}
                                dayGeez={toGeez(ethDay)}
                                event={event}
                                isSelected={isSelected}
                                isCurrent={isCurrent}
                                language={language}
                                onClick={() => handleDateClick(dateStr)}
                            />
                        );
                    })}
                </div>
            );
        } else {
            // GREGORIAN VIEW
            return (
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: gcFirstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square opacity-0"></div>
                    ))}
                    {Array.from({ length: gcDaysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateObj = new Date(displayedGCYear, displayedGCMonth, day);
                        const dateStr = formatLocalDate(dateObj);
                        const event = ORTHODOX_EVENTS_2025.find(e => e.date === dateStr);
                        const isSelected = selectedDate === dateStr;
                        const isCurrent = isToday(dateStr);
                        const dayEthInfo = getEthiopianDate(dateObj);

                        return (
                            <CalendarCell
                                key={dateStr}
                                dayPrimary={day}
                                daySecondary={dayEthInfo.day}
                                dayGeez={toGeez(dayEthInfo.day)}
                                event={event}
                                isSelected={isSelected}
                                isCurrent={isCurrent}
                                language={language}
                                onClick={() => handleDateClick(dateStr)}
                            />
                        );
                    })}
                </div>
            );
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-accent-100 w-full max-w-7xl mx-auto flex flex-col lg:flex-row">
            {/* SIDEBARS: FASTS & FEASTS */}
            <CalendarSidebar title={language === 'ti' ? '7 ዓበይቲ ጾማት' : '7 Major Fasts'} icon="fas fa-moon" items={MAJOR_FASTS_LIST} language={language} color="purple" />

            {/* CENTER: CALENDAR */}
            <div className="flex-grow flex flex-col min-w-0">
                <div className="bg-primary-800 text-white p-6 flex items-center justify-between">
                    <button onClick={prevMonth} className="p-3 hover:bg-primary-700 rounded-full transition-colors active:scale-95">
                        <i className="fas fa-chevron-left text-xl"></i>
                    </button>
                    <div className="text-center">
                        <h3 className="text-2xl font-serif font-bold tracking-tight">
                            {language === 'ti'
                                ? `${currentEthMonth.nameTi} ${currentEthMonth.year}`
                                : `${monthNames[displayedGCMonth]} ${displayedGCYear}`}
                        </h3>
                        <p className="text-primary-200 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                            {language === 'ti' ? 'ዓውደ ኣዋርሕ ኦርቶዶክስ' : 'Ethiopian Orthodox Calendar'}
                        </p>
                    </div>
                    <button onClick={nextMonth} className="p-3 hover:bg-primary-700 rounded-full transition-colors active:scale-95">
                        <i className="fas fa-chevron-right text-xl"></i>
                    </button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-7 mb-4">
                        {(language === 'ti' ? daysOfWeekTi : daysOfWeek).map(day => (
                            <div key={day} className="text-center text-xs font-black text-accent-400 uppercase tracking-widest py-2">
                                {day}
                            </div>
                        ))}
                    </div>
                    {renderGrid()}
                </div>

                <CalendarDetailsPane ethInfo={ethInfo} selectedEvent={selectedEvent} language={language} />
            </div>

            <CalendarSidebar title={language === 'ti' ? '9 ዓበይቲ በዓላት' : '9 Major Feasts'} icon="fas fa-sun" items={MAJOR_FEASTS_LIST} language={language} color="amber" />
        </div>
    );
};

// Sub-components for cleaner code
const CalendarCell: React.FC<{
    dayPrimary: number;
    daySecondary: number;
    dayGeez?: string;
    event?: CalendarEvent;
    isSelected: boolean;
    isCurrent: boolean;
    language: string;
    onClick: () => void
}> = ({ dayPrimary, daySecondary, dayGeez, event, isSelected, isCurrent, language, onClick }) => {
    let bgClass = "hover:bg-accent-50";
    let textClass = "text-accent-700";
    let dotClass = "";

    if (event) {
        if (event.type === 'fast') {
            bgClass = isSelected ? "bg-purple-600" : "bg-purple-100 hover:bg-purple-200";
            textClass = isSelected ? "text-white" : "text-purple-900";
            dotClass = isSelected ? "bg-white" : "bg-purple-500";
        } else if (event.type === 'major_feast') {
            bgClass = isSelected ? "bg-amber-600" : "bg-amber-100 hover:bg-amber-200";
            textClass = isSelected ? "text-white" : "text-amber-900";
            dotClass = isSelected ? "bg-white" : "bg-amber-500";
        } else {
            bgClass = isSelected ? "bg-primary-600" : "bg-primary-100 hover:bg-primary-200";
            textClass = isSelected ? "text-white" : "text-primary-900";
            dotClass = isSelected ? "bg-white" : "bg-primary-500";
        }
    } else if (isCurrent) {
        bgClass = "bg-primary-800 text-white shadow-lg border-primary-900";
        textClass = "text-white";
    }

    if (isSelected) {
        bgClass = "bg-white ring-4 ring-amber-500 ring-offset-2 shadow-2xl scale-110 z-20 border-primary-600";
        textClass = "text-primary-950 font-black";
        if (event) {
            // Keep event color hints but make them more subtle when selected
            if (event.type === 'fast') bgClass = "bg-purple-50 ring-4 ring-amber-500 ring-offset-2 shadow-2xl scale-110 z-20 border-purple-600";
            else if (event.type === 'major_feast') bgClass = "bg-amber-50 ring-4 ring-amber-500 ring-offset-2 shadow-2xl scale-110 z-20 border-amber-600";
        }
    }

    return (
        <button
            onClick={onClick}
            className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-300 border border-transparent ${bgClass} ${isSelected ? 'scale-110 z-10 shadow-lg' : ''}`}
        >
            {language === 'ti' && dayGeez ? (
                <>
                    <span className={`text-2xl font-black ${textClass}`}>{dayGeez}</span>
                    <div className="flex gap-2 mt-1">
                        <span className={`text-[9px] font-bold opacity-70 ${textClass}`}>{dayPrimary}</span>
                        <span className={`text-[9px] font-bold opacity-40 ${textClass}`}>{daySecondary}</span>
                    </div>
                </>
            ) : (
                <>
                    <span className={`text-xl font-black ${textClass}`}>{dayPrimary}</span>
                    <div className="flex gap-1.5 mt-0.5">
                        <span className={`text-[8px] font-black opacity-60 ${textClass}`}>{daySecondary}</span>
                        <span className={`text-[8px] font-black opacity-40 ${textClass}`}>{dayGeez}</span>
                    </div>
                </>
            )}
            {event && <div className={`w-2 h-2 rounded-full absolute bottom-1 transition-colors ${dotClass}`}></div>}
            {isCurrent && !isSelected && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></div>}
        </button>
    );
};

const CalendarSidebar: React.FC<{ title: string; icon: string; items: any[]; language: string; color: 'purple' | 'amber' }> = ({ title, icon, items, language, color }) => {
    const isPurple = color === 'purple';
    return (
        <div className={`w-full lg:w-64 ${isPurple ? 'bg-purple-50 border-r border-purple-100' : 'bg-amber-50 border-l border-amber-100'} p-6`}>
            <h4 className={`${isPurple ? 'text-purple-900' : 'text-amber-900'} font-serif font-bold text-lg mb-4 flex items-center gap-2`}>
                <i className={icon}></i>
                {title}
            </h4>
            <ul className="space-y-3">
                {items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 group">
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${isPurple ? 'bg-purple-400' : 'bg-amber-400'} shrink-0`}></div>
                        <span className={`text-sm ${isPurple ? 'text-purple-800' : 'text-amber-800'} font-medium`}>
                            {language === 'ti' ? item.titleTi : item.title}
                        </span>
                    </li>
                ))}
            </ul>
            {!isPurple && (
                <div className="mt-auto pt-8">
                    <a href={`${process.env.PUBLIC_URL || ''}/Orthodox Calendar 2025.pdf`} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-all">
                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center group-hover:rotate-12 transition-transform">
                            <i className="fas fa-file-pdf"></i>
                        </div>
                        <span className="text-[10px] font-black text-accent-900 uppercase tracking-widest text-center">PDF Calendar</span>
                    </a>
                    <p className="mt-4 text-[10px] font-medium text-amber-900/60 italic text-center leading-relaxed">
                        Acknowledging ቦክረ ሊቃዉንት መምህር አፈወርቅ for the 2025 Orthodox Calendar
                    </p>
                </div>
            )}
        </div>
    );
};

const CalendarDetailsPane: React.FC<{ ethInfo: any; selectedEvent: any; language: string }> = ({ ethInfo, selectedEvent, language }) => {
    if (!ethInfo) return (
        <div className="bg-accent-50 p-6 border-t border-accent-100 min-h-[140px] flex flex-col items-center justify-center text-accent-400 opacity-60">
            <i className="far fa-calendar-check text-4xl mb-2"></i>
            <p className="text-sm font-bold uppercase tracking-widest">Select Date</p>
        </div>
    );

    return (
        <div className="bg-accent-50 p-6 border-t border-accent-100 min-h-[140px] animate-fadeIn transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="bg-primary-700 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-sm">
                            {language === 'ti' ? `${ethInfo.monthTi} ${ethInfo.day}, ${ethInfo.year}` : `${ethInfo.month} ${ethInfo.day}, ${ethInfo.year}`}
                        </div>
                        {selectedEvent && (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${selectedEvent.type === 'fast' ? 'bg-purple-200 text-purple-800' :
                                selectedEvent.type === 'major_feast' ? 'bg-amber-200 text-amber-800' :
                                    'bg-primary-200 text-primary-800'
                                }`}>
                                {selectedEvent.type.replace('_', ' ')}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] font-black text-accent-400 uppercase tracking-widest leading-none mb-1">
                        {language === 'ti' ? 'ናይ ወርሒ ዝኽሪ' : 'Monthly Commemoration'}
                    </p>
                    <h4 className="text-2xl font-serif font-black text-accent-950">
                        {ethInfo.day}/ {language === 'ti' ? ethInfo.commemoration.titleTi : ethInfo.commemoration.title}
                    </h4>
                    {selectedEvent && (
                        <div className="mt-3 pt-3 border-t border-accent-200/50">
                            <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest leading-none mb-1">
                                {language === 'ti' ? 'በዓል / ጾም' : 'Event'}
                            </p>
                            <h5 className="text-xl font-serif font-black text-primary-900">
                                {language === 'ti' ? selectedEvent.titleTi : selectedEvent.title}
                            </h5>
                        </div>
                    )}
                </div>
                <div className="hidden md:block opacity-5 scale-150 rotate-12">
                    <i className="fas fa-cross text-7xl"></i>
                </div>
            </div>
        </div>
    );
};

export default OrthodoxCalendar;
