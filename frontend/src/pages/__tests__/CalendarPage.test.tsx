import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import CalendarPage from '../CalendarPage';

// OrthodoxCalendar renders a large generated grid; this page's job is only to
// wrap it in a route-level heading, so the child is stubbed.
jest.mock('../../components/OrthodoxCalendar', () => () => (
  <div data-testid="orthodox-calendar" />
));

jest.mock('../../i18n/I18nProvider', () => ({
  useI18n: () => ({ lang: 'en', setLang: jest.fn(), t: (k: string) => k })
}));

describe('CalendarPage', () => {
  it('renders the calendar at its own route', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    expect(screen.getByTestId('orthodox-calendar')).toBeInTheDocument();
  });

  it('has a top-level heading so the route is not a bare grid', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
