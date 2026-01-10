import React from 'react';
import { geezMap } from '../../utils/geezTransliteration';

interface TransliterationHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    variant?: 'modal' | 'embedded';
}

const TransliterationHelpModal: React.FC<TransliterationHelpModalProps> = ({
    isOpen,
    onClose,
    variant = 'modal'
}) => {
    if (!isOpen && variant === 'modal') return null;
    // If embedded, we might rely on parent to hide it, or return null. 
    // Usually embedded means it's always "rendered" but maybe hidden by CSS or parent logic.
    if (!isOpen && variant === 'embedded') return null;

    // Helper to organize the map for display
    // We want to group by consonant families if possible, or just list them.
    // A full Fidel table is complex to reconstruct perfectly from the map automatically 
    // without metadata, but we can list common mappings.

    // Let's create a structured view of the most important mappings.
    // We can group by the Latin consonant start.
    const groups: { [key: string]: { latin: string, geez: string }[] } = {};

    Object.entries(geezMap).forEach(([latin, geez]) => {
        // Skip some special casing or very long ones if needed, but for now show all
        // Group by the first letter of latin (approximation for consonant)
        const key = latin.charAt(0).toLowerCase();
        // Special case: 'sh', 'ch', 'ny', 'gn' -> treat as group
        let groupKey = key;

        if (latin.startsWith('sh')) groupKey = 'sh';
        else if (latin.startsWith('ch')) groupKey = 'ch';
        else if (latin.startsWith('ny')) groupKey = 'ny';
        else if (latin.startsWith('ts')) groupKey = 'ts';
        else if (latin.startsWith('gn')) groupKey = 'gn'; // if exists

        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push({ latin, geez });
    });

    // Sort keys: vowels first, then alphabetical
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
        const isVowelA = /^[aeiou]$/.test(a);
        const isVowelB = /^[aeiou]$/.test(b);
        if (isVowelA && !isVowelB) return -1;
        if (!isVowelA && isVowelB) return 1;
        return a.localeCompare(b);
    });

    const Content = () => (
        <div className={`bg-white flex flex-col h-full ${variant === 'modal' ? 'rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh]' : 'w-full h-full'}`}>
            <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                    Ge'ez Transliteration Guide
                </h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                    <i className="fas fa-times text-xl"></i>
                </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
                <p className="mb-4 text-gray-600 text-sm">
                    Type the <strong>Latin</strong> characters to get the corresponding <strong>Ge'ez</strong> symbol.
                </p>

                <div className={`grid gap-6 ${variant === 'embedded' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                    {sortedGroupKeys.map(groupKey => {
                        // Sort entries within group: length ascending, then alphabetical?
                        // Standard order: he, hu, hi, ha, hie, h, ho
                        // This corresponds loosely to suffix: e, u, i, a, ie, (none), o
                        const items = groups[groupKey].sort((a, b) => {
                            const order = ['e', 'u', 'i', 'a', 'ie', '', 'o'];
                            const getSuffix = (str: string) => {
                                if (str === groupKey) return ''; // 6th order often matches base
                                if (str.startsWith(groupKey)) return str.slice(groupKey.length);
                                return str;
                            };
                            const suffixA = getSuffix(a.latin);
                            const suffixB = getSuffix(b.latin);
                            return order.indexOf(suffixA) - order.indexOf(suffixB);
                        });

                        return (
                            <div key={groupKey} className="border rounded-lg p-3 bg-gray-50 break-inside-avoid">
                                <h4 className="font-bold text-gray-700 border-b pb-1 mb-2 capitalize">
                                    {groupKey}
                                </h4>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
                                    {items.map(({ latin, geez }) => (
                                        <div key={latin} className="flex justify-between items-center px-2 py-1 hover:bg-white rounded">
                                            <span className="font-mono text-gray-500">{latin}</span>
                                            <span className="font-bold text-gray-900">{geez}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {variant === 'modal' && (
                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );

    if (variant === 'embedded') {
        return <Content />;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex justify-center items-center p-4">
            <Content />
        </div>
    );
};

export default TransliterationHelpModal;
