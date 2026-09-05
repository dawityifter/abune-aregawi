import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WhatsHappeningSection from '../WhatsHappeningSection';

jest.mock('../../../i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

const PDF = '/docs/Raising_Children_Orthodox_Tewahedo_Faith.pdf';
const PPTX = '/docs/Raising_Children_Orthodox_Tewahedo_Faith.pptx';

const openViewer = () => {
  render(<WhatsHappeningSection />);
  fireEvent.click(screen.getByText('common.cta.readMore'));
};

describe('teaching document viewer', () => {
  it('is closed until Read More is clicked', () => {
    render(<WhatsHappeningSection />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens an in-page viewer embedding the PDF export', () => {
    openViewer();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // The .pptx itself cannot render in a browser — the embed must be the PDF
    const frame = screen.getByTitle('sections.announcements.teachings.title');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', PDF);
  });

  it('offers the PDF in a new tab and the original slides as a download', () => {
    openViewer();

    const newTab = screen.getByText('docViewer.openInNewTab').closest('a')!;
    expect(newTab).toHaveAttribute('href', PDF);
    expect(newTab).toHaveAttribute('target', '_blank');
    expect(newTab).toHaveAttribute('rel', expect.stringContaining('noopener'));

    const download = screen.getByText('docViewer.download').closest('a')!;
    expect(download).toHaveAttribute('href', PPTX);
    expect(download).toHaveAttribute('download');
  });

  it('closes on the close button, the backdrop, and Escape', () => {
    openViewer();
    fireEvent.click(screen.getByLabelText('docViewer.close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('common.cta.readMore'));
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('common.cta.readMore'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not close when the document panel itself is clicked', () => {
    openViewer();
    // Scoped to the dialog: the section card behind it shares this heading
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('heading', {
      name: 'sections.announcements.teachings.title'
    }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('teaching preview thumbnail', () => {
  const PREVIEW = '/images/teachings/raising-children-preview.jpg';

  it('shows a slide preview in the announcement card', () => {
    render(<WhatsHappeningSection />);
    const img = screen.getByAltText('sections.announcements.teachings.title');
    expect(img).toHaveAttribute('src', PREVIEW);
    // A static image, not the multi-megabyte PDF, keeps the home page light
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('opens the same viewer when the preview is clicked', () => {
    render(<WhatsHappeningSection />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByAltText('sections.announcements.teachings.title'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTitle('sections.announcements.teachings.title'))
      .toHaveAttribute('src', PDF);
  });
});
