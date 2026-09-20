import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { MerchProduct, formatMoney } from '../../config/merch';

interface Props {
  product: MerchProduct;
  /** size -> quantity. A size absent from the map means none of it. */
  quantities: Record<string, number>;
  onChange: (size: string, quantity: number) => void;
  disabled?: boolean;
}

/**
 * One quantity box per size, each showing its own price.
 *
 * A grid rather than a size dropdown plus a single quantity, because ordering
 * two smalls and a large for a family is the common case here and the dropdown
 * version makes that three trips through the form. Showing the price on each
 * row matters more now that sizes cost different amounts.
 */
const SizeQuantityPicker: React.FC<Props> = ({ product, quantities, onChange, disabled }) => {
  const { t } = useI18n();

  const handle = (size: string, raw: string) => {
    // An empty box is "none of this size", not NaN.
    if (raw === '') {
      onChange(size, 0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    // Clamped here as well as on the server: a purchaser should not have to
    // reach Stripe to discover the limit.
    const clamped = Math.max(0, Math.min(parsed, product.max_quantity_per_size));
    onChange(size, clamped);
  };

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-gray-900">
        {t('merch.product.sizeLabel')} &amp; {t('merch.product.quantityLabel')}
      </legend>

      <div className="mt-3 space-y-2">
        {product.sizes.map(({ size, unit_amount: unitAmount }) => (
          <div
            key={size}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div>
              <label htmlFor={`merch-size-${size}`} className="text-sm font-semibold text-gray-900">
                {size}
              </label>
              <div className="text-sm text-gray-600">
                {formatMoney(unitAmount, product.currency)}
              </div>
            </div>
            <input
              id={`merch-size-${size}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={product.max_quantity_per_size}
              step={1}
              disabled={disabled}
              // The visible label is just the size, which would read as "S", "L"
              // to a screen reader with no hint of what the box does.
              aria-label={`Quantity for size ${size}`}
              value={quantities[size] ?? 0}
              onChange={(e) => handle(size, e.target.value)}
              className="w-16 rounded-md border-gray-300 text-right text-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-100"
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
};

export default SizeQuantityPicker;
