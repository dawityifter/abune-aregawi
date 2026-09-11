import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QRCode from 'qrcode';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import PledgeQrCode, { PLEDGE_QR_URL, PLEDGE_QR_OPTIONS } from '../PledgeQrCode';
import PledgeIntentSelector from '../PledgeIntentSelector';

const wrap = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

// The encoder emits two paths: a plain white background, then the pattern
// itself as a stroked path. Only the second carries the encoded data — the
// background is identical for any URL that fits the same grid, so matching on
// it would compare nothing.
const pathData = (svg: string | null): string | null => {
  const match = svg?.match(/stroke="[^"]*"\s+d="([^"]+)"/);
  return match ? match[1] : null;
};

describe('PledgeQrCode', () => {
  it('points at the production pledge page, not wherever it is being served from', () => {
    // Deriving this from window.location.origin would encode localhost while
    // testing and a *.web.app address on a Firebase preview channel. A code
    // meant to be photographed off a television has to be absolute.
    expect(PLEDGE_QR_URL).toBe('https://abunearegawi.church/pledge');
  });

  it('renders a QR code encoding that URL', async () => {
    const { container } = wrap(<PledgeQrCode />);

    const svg = await waitFor(() => {
      const found = container.querySelector('svg');
      expect(found).not.toBeNull();
      return found!;
    });

    const expected = await QRCode.toString(PLEDGE_QR_URL, PLEDGE_QR_OPTIONS);
    expect(pathData(svg.outerHTML)).toBe(pathData(expected));
  });

  it('encodes something different from a decoy URL', async () => {
    // Guards the assertion above: if pathData ever returned null for both, the
    // comparison would pass vacuously.
    const decoy = await QRCode.toString('https://example.test/pledge', PLEDGE_QR_OPTIONS);
    const real = await QRCode.toString(PLEDGE_QR_URL, PLEDGE_QR_OPTIONS);
    expect(pathData(real)).not.toBe(pathData(decoy));
    expect(pathData(real)).not.toBeNull();
  });

  it('stays off phone screens', async () => {
    // jsdom applies no CSS, so the Tailwind breakpoint classes are the only
    // observable form this rule takes.
    const { container } = wrap(<PledgeQrCode />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());

    const root = container.firstElementChild!;
    expect(root.className).toContain('hidden');
    expect(root.className).toContain('md:');
  });

  it('shows the address in readable text for a camera that will not focus', async () => {
    wrap(<PledgeQrCode />);
    expect(await screen.findByText('abunearegawi.church/pledge')).toBeInTheDocument();
  });
});

describe('PledgeIntentSelector QR placement', () => {
  it('shows the QR code below the anonymous giving card', async () => {
    const { container } = wrap(
      <PledgeIntentSelector signedIn={false} onChoose={jest.fn()} onSignIn={jest.fn()} />
    );

    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());

    const anonymousCard = screen.getByRole('button', { name: /give anonymously now/i });
    const qrRoot = container.querySelector('svg')!.closest('[data-testid="pledge-qr"]')!;

    // DOCUMENT_POSITION_FOLLOWING: the QR comes after the card in the document.
    expect(anonymousCard.compareDocumentPosition(qrRoot) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });
});
