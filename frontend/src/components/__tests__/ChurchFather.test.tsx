import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import ChurchFather from '../ChurchFather';

const renderSection = () => render(
  <I18nProvider><LanguageProvider><ChurchFather /></LanguageProvider></I18nProvider>
);

describe('ChurchFather', () => {
  it('names the priest and labels him', () => {
    const { container } = renderSection();
    expect(screen.getByText('Our Church Father')).toBeInTheDocument();
    expect(container.textContent).toContain('Tadesse');
  });

  it('carries the #priest anchor the old card linked to', () => {
    const { container } = renderSection();
    expect(container.querySelector('#priest')).toBeInTheDocument();
  });

  it('gives the portrait the priest\'s name as alt text, not a bare filename', () => {
    renderSection();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', expect.stringContaining('Tadesse'));
    expect(img).toHaveAttribute('src', expect.stringContaining('meleakeTsehay-Tadesse.png'));
  });

  it('is not a link: the card used to point at an anchor that did not exist', () => {
    const { container } = renderSection();
    expect(container.querySelector('a')).toBeNull();
  });
});
