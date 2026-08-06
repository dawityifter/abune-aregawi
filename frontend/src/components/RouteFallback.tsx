import React from 'react';

/**
 * Shown while a lazily-loaded route's chunk downloads.
 *
 * Matches the spinner the authenticated pages already use, so a split route
 * looks like a page still loading rather than a different kind of wait.
 */
const RouteFallback: React.FC = () => (
  <div
    className="min-h-screen flex items-center justify-center"
    role="status"
    aria-live="polite"
    aria-label="Loading"
    style={{
      backgroundImage: `url(${process.env.PUBLIC_URL || ''}/bylaws/TigrayOrthodox-background.png)`,
      backgroundRepeat: 'repeat',
      backgroundPosition: 'top left'
    }}
  >
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800" />
  </div>
);

export default RouteFallback;
