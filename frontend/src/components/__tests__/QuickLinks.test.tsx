import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import QuickLinks from '../QuickLinks';

const renderWithProviders = () => render(
  <BrowserRouter><I18nProvider><LanguageProvider><QuickLinks /></LanguageProvider></I18nProvider></BrowserRouter>
);

describe('QuickLinks', () => {
  it('links to the survey page', () => {
    renderWithProviders();
    const link = screen.getByText('Church Services Survey').closest('a');
    expect(link).toHaveAttribute('href', '/survey');
  });
});
