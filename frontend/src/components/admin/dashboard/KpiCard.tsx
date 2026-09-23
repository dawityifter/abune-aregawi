import React from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  secondary?: string;
  /** A second visible caption line, e.g. a definition under a run-rate line. */
  note?: string;
}

/**
 * One card. Takes already-formatted strings so it cannot accidentally render a
 * withheld figure as zero — the formatting decision lives in formatFigure and
 * is made once, upstream.
 *
 * Height is unconstrained on purpose: Tigrigna labels run 20-40% longer than
 * their English counterparts and a fixed height clips them.
 */
const KpiCard: React.FC<KpiCardProps> = ({ label, value, secondary, note }) => (
  <div className="h-full rounded-md border border-accent-200 bg-accent-50 p-4">
    <p className="font-sans text-caption text-accent-500">{label}</p>
    <p className="mt-1 font-sans text-h2 tabular-nums text-accent-700">{value}</p>
    {secondary && <p className="mt-1 font-sans text-caption text-accent-500">{secondary}</p>}
    {note && <p className="mt-1 font-sans text-caption text-accent-500">{note}</p>}
  </div>
);

export default KpiCard;
