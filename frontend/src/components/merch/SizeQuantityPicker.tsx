import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { MerchProduct, formatMoney } from '../../config/merch';

interface Props {
  product: MerchProduct;
  currency: string;
  /**
   * "productKey|size" -> quantity, shared across every picker on the page. A
   * cell absent from the map means none of it. Keyed on both because a youth S
   * and an adult S are different shirts.
   */
  quantities: Record<string, number>;
  onChange: (productKey: string, size: string, quantity: number) => void;
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
const SizeQuantityPicker: React.FC<Props> = ({
  product, currency, quantities, onChange, disabled
}) => {
  const { t } = useI18n();
  const cell = (size: string) => `${product.product_key}|${size}`;
  // Ids must be unique across the page now that there are several pickers, or
  // a label would point at whichever input rendered first.
  const inputId = (size: string) => `merch-size-${product.product_key}-${size}`;

  const handle = (size: string, raw: string) => {
    // An empty box is "none of this size", not NaN.
    if (raw === '') {
      onChange(product.product_key, size, 0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    // Clamped here as well as on the server: a purchaser should not have to
    // reach Stripe to discover the limit.
    const clamped = Math.max(0, Math.min(parsed, product.max_quantity_per_size));
    onChange(product.product_key, size, clamped);
  };

  return (
    <fieldset>
      {/* The garment names the fieldset. With two shirts on one page, a legend
          reading only "Size & Quantity" twice leaves a purchaser — and a screen
          reader working through the form — with no way to tell which is which. */}
      <legend className="text-sm font-semibold text-gray-900">
        {product.product_name}
        <span className="ml-2 font-normal text-gray-600">
          ({t('merch.product.sizeLabel')} &amp; {t('merch.product.quantityLabel')})
        </span>
      </legend>

      <div className="mt-3 space-y-2">
        {product.sizes.map(({ size, unit_amount: unitAmount }) => (
          <div
            key={size}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div>
              <label htmlFor={inputId(size)} className="text-sm font-semibold text-gray-900">
                {size}
              </label>
              <div className="text-sm text-gray-600">
                {formatMoney(unitAmount, currency)}
              </div>
            </div>
            <input
              id={inputId(size)}
              type="number"
              inputMode="numeric"
              min={0}
              max={product.max_quantity_per_size}
              step={1}
              disabled={disabled}
              // The visible label is just the size, which would read as "S", "L"
              // to a screen reader with no hint of what the box does.
              aria-label={`Quantity for ${product.product_name} size ${size}`}
              value={quantities[cell(size)] ?? 0}
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
