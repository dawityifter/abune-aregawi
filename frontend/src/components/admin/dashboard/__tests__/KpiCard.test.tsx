import React from 'react';
import { render, screen } from '@testing-library/react';
import KpiCard from '../KpiCard';

describe('KpiCard', () => {
  it('renders the label, value and secondary line', () => {
    render(<KpiCard label="Received" value="$45,581" secondary="needs $545/day for 100 days" />);
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('$45,581')).toBeInTheDocument();
    expect(screen.getByText('needs $545/day for 100 days')).toBeInTheDocument();
  });

  it('renders an optional note as a second visible line', () => {
    render(<KpiCard label="Received" value="$45,581"
      secondary="needs $545/day for 100 days" note="Payments allocated to pledges in this drive" />);
    expect(screen.getByText('needs $545/day for 100 days')).toBeInTheDocument();
    expect(screen.getByText('Payments allocated to pledges in this drive')).toBeInTheDocument();
  });

  it('renders without a secondary line', () => {
    render(<KpiCard label="Received" value="$45,581" />);
    expect(screen.getByText('$45,581')).toBeInTheDocument();
  });

  // Tigrigna runs 20-40% longer than English. A fixed height would clip it.
  it('does not constrain its own height', () => {
    const { container } = render(<KpiCard label="ተቐቢሉ" value="$45,581" />);
    expect(container.firstChild).toHaveClass('h-full');
    expect((container.firstChild as HTMLElement).className).not.toMatch(/\bh-\d/);
  });

  it('renders a withheld value as the em dash it was given', () => {
    render(<KpiCard label="Overpaid" value="—" secondary="withheld to protect a small group" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
