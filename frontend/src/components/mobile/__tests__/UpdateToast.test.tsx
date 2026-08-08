import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UpdateToast from '../UpdateToast';
import { en, ti } from '../../../i18n/dictionaries';

let mockActiveLang: 'en' | 'ti' = 'en';
jest.mock('../../../i18n/I18nProvider', () => ({
  useI18n: () => {
    const dicts = jest.requireActual('../../../i18n/dictionaries');
    const dict = mockActiveLang === 'ti' ? dicts.ti : dicts.en;
    return {
      lang: mockActiveLang,
      setLang: jest.fn(),
      t: (key: string) => {
        const walk = (o: any) => key.split('.').reduce((acc: any, k) => acc?.[k], o);
        return dict[key] ?? walk(dict) ?? dicts.en[key] ?? walk(dicts.en) ?? key;
      }
    };
  }
}));

afterEach(() => { mockActiveLang = 'en'; });

describe('UpdateToast', () => {
  it('renders nothing when no update is available', () => {
    const { container } = render(<UpdateToast show={false} onRefresh={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the update politely to assistive technology', () => {
    render(<UpdateToast show onRefresh={jest.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is pressed', () => {
    const onRefresh = jest.fn();
    render(<UpdateToast show onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: (en as any).pwa.refresh }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders in Tigrigna when the language is Tigrigna', () => {
    mockActiveLang = 'ti';
    render(<UpdateToast show onRefresh={jest.fn()} />);
    expect(screen.getByText((ti as any).pwa.updateAvailable)).toBeInTheDocument();
  });
});
