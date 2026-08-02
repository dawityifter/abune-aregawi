import React from 'react';

interface SkippedNumbersModalProps {
  title: string;
  warning: string;
  note: string;
  rangeLabel: string;
  noneFoundLabel: string;
  closeLabel: string;
  numbers: number[];
  range: { start: number; end: number } | null;
  onClose: () => void;
}

/**
 * Presentational modal listing gaps in a numbered sequence (receipt numbers,
 * check numbers). Holds no data-fetching or i18n of its own — callers pass the
 * already-translated strings for their sequence.
 */
const SkippedNumbersModal: React.FC<SkippedNumbersModalProps> = ({
  title,
  warning,
  note,
  rangeLabel,
  noneFoundLabel,
  closeLabel,
  numbers,
  range,
  onClose
}) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
    <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full m-4">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center text-yellow-600">
          <i className="fas fa-exclamation-triangle mr-2"></i>
          {title}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <span className="sr-only">Close</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="px-6 py-4">
        <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {warning}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          {range && (
            <p className="text-sm text-gray-600 mb-2">
              {rangeLabel}: <span className="font-semibold">{range.start} - {range.end}</span>
            </p>
          )}

          {numbers.length > 0 ? (
            <div className="bg-gray-50 rounded-md p-3 max-h-60 overflow-y-auto border border-gray-200">
              <div className="flex flex-wrap gap-2">
                {numbers.map(num => (
                  <span key={num} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    #{num}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-green-600">
              <i className="fas fa-check-circle text-2xl mb-2"></i>
              <p>{noneFoundLabel}</p>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-500">
          <p>{note}</p>
        </div>
      </div>
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
        <button
          onClick={onClose}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  </div>
);

export default SkippedNumbersModal;
