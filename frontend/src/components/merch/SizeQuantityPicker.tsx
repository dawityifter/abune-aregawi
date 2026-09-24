import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { MerchProduct, formatMoney, productDisplayName } from '../../config/merch';

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

/** At or below this many left, the row says so. Above it, the count is noise. */
const LOW_STOCK = 10;

/**
 * One row per size: the size, its price, what is left, and a − / + stepper.
 *
 * A stepper rather than a bare number box. The browser's own spinner arrows
 * are tiny, easy to miss on a phone, and a mouse wheel scrolling past the box
 * silently changes the quantity — so they are hidden and the box ignores the
 * wheel. The box stays typeable for anyone ordering a dozen.
 *
 * A grid rather than a size dropdown plus a single quantity, because ordering
 * two smalls and a large for a family is the common case here and the dropdown
 * version makes that three trips through the form.
 */
const SizeQuantityPicker: React.FC<Props> = ({
  product, currency, quantities, onChange, disabled
}) => {
  const { t, lang } = useI18n();
  const productName = productDisplayName(product, lang);
  const cell = (size: string) => `${product.product_key}|${size}`;
  // Ids must be unique across the page now that there are several pickers, or
  // a label would point at whichever input rendered first.
  const inputId = (size: string) => `merch-size-${product.product_key}-${size}`;

  const sizeName = (size: string) => {
    const name = t(`merch.product.sizeNames.${size}`);
    // t() hands back the key itself when there is no translation for a size.
    return name.startsWith('merch.') ? size : name;
  };

  // What one row may go up to: the per-order ceiling, or what is left, whichever
  // is lower. Stock is re-checked on the server at checkout either way.
  const maxFor = (available: number) => Math.max(0, Math.min(product.max_quantity_per_size, available));

  const set = (size: string, available: number, quantity: number) => {
    onChange(product.product_key, size, Math.max(0, Math.min(quantity, maxFor(available))));
  };

  const handleTyped = (size: string, available: number, raw: string) => {
    // An empty box is "none of this size", not NaN.
    if (raw === '') {
      onChange(product.product_key, size, 0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    // Clamped here as well as on the server: a purchaser should not have to
    // reach Stripe to discover the limit.
    set(size, available, parsed);
  };

  const stepButton =
    'flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-xl font-semibold text-gray-800 ' +
    'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ' +
    'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400';

  return (
    <fieldset>
      {/* The garment names the fieldset. With two shirts on one page, a legend
          reading only "Size & Quantity" twice leaves a purchaser — and a screen
          reader working through the form — with no way to tell which is which. */}
      <legend className="text-sm font-semibold text-gray-900">
        {productName}
        <span className="ml-2 font-normal text-gray-600">
          ({t('merch.product.sizeLabel')} &amp; {t('merch.product.quantityLabel')})
        </span>
      </legend>

      <div className="mt-3 space-y-2">
        {product.sizes.map(({ size, unit_amount: unitAmount, available }) => {
          const quantity = quantities[cell(size)] ?? 0;
          const soldOut = available <= 0;
          const max = maxFor(available);
          const atMax = !soldOut && quantity >= max;
          const rowDisabled = disabled || soldOut;
          const stockId = `${inputId(size)}-stock`;
          const described = `${productName}, ${sizeName(size)}`;

          return (
            <div
              key={size}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                soldOut ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="min-w-0">
                <label
                  htmlFor={inputId(size)}
                  className={`block text-base font-semibold ${soldOut ? 'text-gray-500' : 'text-gray-900'}`}
                >
                  {sizeName(size)} <span className="font-normal text-gray-500">({size})</span>
                </label>
                <div className="text-sm text-gray-600">
                  {formatMoney(unitAmount, currency)}
                  {soldOut ? (
                    <span
                      id={stockId}
                      className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700"
                    >
                      {t('merch.product.soldOut')}
                    </span>
                  ) : available <= LOW_STOCK ? (
                    <span id={stockId} className="ml-2 text-xs font-medium text-amber-700">
                      {t('merch.product.onlyLeft').replace('{count}', String(available))}
                    </span>
                  ) : null}
                </div>
                {atMax && quantity > 0 && (
                  <p className="mt-1 text-xs text-gray-600" aria-live="polite">
                    {t('merch.product.maxReached')}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className={stepButton}
                  onClick={() => set(size, available, quantity - 1)}
                  disabled={rowDisabled || quantity <= 0}
                  aria-label={`${t('merch.product.removeOne')}: ${described}`}
                >
                  <span aria-hidden="true">−</span>
                </button>
                <input
                  id={inputId(size)}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={max}
                  step={1}
                  disabled={rowDisabled}
                  // The visible label is the size alone, which would read as
                  // "Small" to a screen reader with no hint of what the box does.
                  aria-label={t('merch.product.quantityFor').replace('{product}', productName).replace('{size}', size)}
                  aria-describedby={soldOut || available <= LOW_STOCK ? stockId : undefined}
                  value={quantity}
                  onChange={(e) => handleTyped(size, available, e.target.value)}
                  // A wheel over a focused number box changes its value. Letting
                  // go of focus makes the wheel scroll the page instead.
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onFocus={(e) => e.target.select()}
                  className="h-11 w-14 rounded-md border-gray-300 text-center text-lg font-semibold focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  className={stepButton}
                  onClick={() => set(size, available, quantity + 1)}
                  disabled={rowDisabled || atMax}
                  aria-label={`${t('merch.product.addOne')}: ${described}`}
                >
                  <span aria-hidden="true">+</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
};

export default SizeQuantityPicker;
