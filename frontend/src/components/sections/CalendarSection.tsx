import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import OrthodoxCalendar from '../OrthodoxCalendar';

const CalendarSection: React.FC = () => {
    const { t } = useLanguage();

    return (
        <section className="py-16 bg-accent-50/50">
            <div className="container mx-auto px-4">
                <h2 className="section-title text-center mb-12">
                    {t('calendar.title') || 'Orthodox Calendar 2025'}
                </h2>
                <div className="flex flex-col items-center justify-center gap-12">
                    <div className="w-full max-w-7xl">
                        <OrthodoxCalendar />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CalendarSection;
