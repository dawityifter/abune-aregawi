import React from 'react';

/**
 * The parish mark.
 *
 * An Aksumite-style cross drawn as geometric interlace — squares and a pierced
 * centre — rather than a solid Latin crucifix. The Ethiopian cross is line
 * work, not a filled shape, which is why this is all strokes.
 *
 * Replaces the generic Font Awesome `fa-church` glyph that was standing in for
 * the parish's identity in the header and on the sign-in screen. Inline SVG so
 * it costs no request and inherits `currentColor` from whatever it sits in.
 */

interface AksumCrossProps {
  /** Tailwind sizing classes, e.g. "h-8 w-8". */
  className?: string;
  /**
   * Accessible name. Omit for decorative use — the cross is then hidden from
   * assistive tech, which is correct when it sits next to the church name.
   */
  title?: string;
}

const AksumCross: React.FC<AksumCrossProps> = ({ className = 'h-8 w-8', title }) => (
  <svg
    viewBox="0 0 100 116"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.6}
    strokeLinejoin="round"
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    {title ? <title>{title}</title> : null}
    {/* The two arms */}
    <rect x="41" y="6" width="18" height="104" />
    <rect x="8" y="39" width="84" height="18" />
    {/* The interlaced centre */}
    <rect x="33" y="31" width="34" height="34" />
    <rect x="41" y="39" width="18" height="18" />
    {/* Terminal squares at each arm end */}
    <rect x="41" y="6" width="18" height="18" />
    <rect x="8" y="39" width="18" height="18" />
    <rect x="74" y="39" width="18" height="18" />
    {/* Hairlines through the axes, as in the woven originals */}
    <path d="M50 6 v104 M8 48 h84" strokeWidth={1} opacity={0.45} />
    <circle cx="50" cy="48" r="3.4" strokeWidth={2} />
  </svg>
);

export default AksumCross;
