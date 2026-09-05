import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrthodoxCalendar from '../OrthodoxCalendar';

let mockLanguage = 'en';
jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: mockLanguage, t: (k: string) => k }),
}));

/** The pane shows this placeholder only while no date is selected. */
const placeholder = () => screen.queryByText('Select Date');
const commemoration = () => screen.queryByText('Monthly Commemoration');

beforeEach(() => {
  mockLanguage = 'en';
});

describe('OrthodoxCalendar — today selected on arrival', () => {
  it('opens with a date already selected rather than an empty pane', () => {
    render(<OrthodoxCalendar />);

    expect(placeholder()).not.toBeInTheDocument();
    expect(commemoration()).toBeInTheDocument();
  });

  it('marks exactly one cell as selected, and it is today', () => {
    render(<OrthodoxCalendar />);

    const pressed = screen.getAllByRole('button').filter(
      (b) => b.getAttribute('aria-pressed') === 'true'
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAttribute('aria-current', 'date');
  });

  it('does the same in the Tigrigna view', () => {
    mockLanguage = 'ti';
    render(<OrthodoxCalendar />);

    expect(placeholder()).not.toBeInTheDocument();
    expect(screen.queryByText('ናይ ወርሒ ዝኽሪ')).toBeInTheDocument();
  });

  it('still lets the visitor deselect by clicking the selected day', () => {
    render(<OrthodoxCalendar />);
    expect(commemoration()).toBeInTheDocument();

    const selected = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-pressed') === 'true') as HTMLElement;
    fireEvent.click(selected);

    expect(placeholder()).toBeInTheDocument();
  });

  it('clears the selection when the visitor changes month', () => {
    render(<OrthodoxCalendar />);
    expect(commemoration()).toBeInTheDocument();

    fireEvent.click(document.querySelectorAll('button')[0]);

    expect(placeholder()).toBeInTheDocument();
  });
});
