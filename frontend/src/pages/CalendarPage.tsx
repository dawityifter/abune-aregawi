import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import OrthodoxCalendar from '../components/OrthodoxCalendar';

/**
 * The calendar was only ever a section on the home page. The mobile bottom bar
 * needs a real route so the tab is deep-linkable and Back behaves correctly.
 * The home page keeps its section; both render the same component.
 */
const CalendarPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        <h1 className="section-title text-center mb-12">{t('calendar.title')}</h1>
        <OrthodoxCalendar />
      </div>
    </div>
  );
};

export default CalendarPage;
