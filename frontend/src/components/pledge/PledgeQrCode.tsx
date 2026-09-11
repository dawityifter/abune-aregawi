import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useI18n } from '../../i18n/I18nProvider';

// Absolute, and deliberately not derived from window.location.origin: this code
// exists to be photographed off a television, so it must point at production
// even when the page rendering it is localhost or a Firebase preview channel.
export const PLEDGE_QR_URL = 'https://abunearegawi.church/pledge';

// `type` is pinned because the two builds of this library disagree without it —
// the browser build always emits SVG, the Node build (which Jest may resolve)
// defaults to ASCII art. `margin: 1` trims the quiet zone to the minimum the
// spec allows, so the pattern stays as large as possible on screen.
export const PLEDGE_QR_OPTIONS = { type: 'svg' as const, margin: 1 };

// Shown on the pledge page for a congregation watching a television: scan it
// and the pledge page opens on your own phone. Hidden on phones, where a code
// pointing at the page you are already reading is no use and would push the
// giving options below the fold.
const PledgeQrCode: React.FC = () => {
  const { t } = useI18n();
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toString(PLEDGE_QR_URL, PLEDGE_QR_OPTIONS)
      .then((markup) => { if (active) setSvg(markup); })
      .catch(() => { if (active) setSvg(null); });
    return () => { active = false; };
  }, []);

  // Nothing to show until the encoder resolves, and nothing to show if it
  // failed — the giving options below are the actual purpose of the page.
  if (!svg) return null;

  return (
    <div
      data-testid="pledge-qr"
      className="hidden md:flex flex-col items-center rounded-lg border border-gray-200 bg-white p-6"
    >
      {/* The markup comes from the encoder applied to a hard-coded constant —
          no user input reaches it. The SVG carries a viewBox and no width, so
          it scales to whatever the wrapper gives it. */}
      <div
        role="img"
        aria-label={t('pledge.qr.caption')}
        className="w-64 lg:w-80 xl:w-96 [&>svg]:w-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="mt-4 text-base font-semibold text-gray-900">{t('pledge.qr.caption')}</p>
      <p className="mt-1 text-sm text-gray-600">abunearegawi.church/pledge</p>
    </div>
  );
};

export default PledgeQrCode;
