import { useState, useCallback, useRef } from 'react';
import { geezMap } from '../utils/geezTransliteration';

interface UseGeezTransliterationProps {
    enabled: boolean;
    value: string;
    onChange: (value: string) => void;
}

export const useGeezTransliteration = ({ enabled, value, onChange }: UseGeezTransliterationProps) => {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;

        if (!enabled) {
            onChange(newValue);
            return;
        }

        // Handle backspace or deletion - pass through directly
        if (newValue.length < value.length) {
            onChange(newValue);
            return;
        }

        // Capture the insertion
        const selectionStart = e.target.selectionStart || newValue.length;
        const charInserted = newValue.slice(selectionStart - 1, selectionStart);

        // If inserted char is not a valid map key part (e.g. space, punctuation), just pass through
        // But we might need to process previous chars. 
        // For simplicity V1: complete replacement logic at cursor.

        // We need to look at what was before the cursor. 
        // Let's attempt to match phonetic patterns.
        // e.g. User has "ሰ" (s -> se -> s -> s? No, map usually maps 's' -> 'ስ')
        // Let's assume standard mapping:
        // s -> ስ
        // s + e -> ሰ
        // s + u -> ሱ

        // We need to look at the character *before* the insertion point in the *old* value?
        // Or just look at the new value buffer.

        // Implementation Strategy:
        // 1. Identify the "syllable" being built.
        // 2. Syllables usually start with a Consonant.
        // 3. Vowels modify the Consonant.

        // Let's act on the character immediately preceding the cursor.
        const preCursor = newValue.slice(0, selectionStart);
        const postCursor = newValue.slice(selectionStart);

        let processedPreCursor = preCursor;

        // Check the last 1-4 characters of the pre-cursor string for a match in our map
        // We want to verify if the user typed a vowel that should modify the previous char.

        // Reverse logic:
        // 1. Did user type a vowel?
        // 2. If yes, check if previous char is a "base" (6th order) Ethiopic char that can be modified.
        // This requires a reverse map or a syllable map.

        // Alternative:
        // Maintain a "buffer" of Latin chars for the current word? No, that's complex to sync.

        // WORKING STRATEGY: Suffix Replacement.
        // Iterate backwards from cursor, trying to find the longest Latin string that maps to a symbol.
        // BUT we don't have the Latin source anymore for the previous chars, only the Ge'ez.

        // So we need a hybrid map:
        // [Ge'ez 6th order] + [Latin Vowel] -> [Ge'ez Nth order]
        // e.g. 'ስ' + 'e' -> 'ሰ'
        // 'ስ' + 'u' -> 'ሱ'

        // We also need: [Latin Consonant] -> [Ge'ez 6th order]
        // e.g. 's' -> 'ስ'

        // And combinations: 's' + 'h' -> 'ሽ'
        // 'ሽ' + 'e' -> 'ሸ'

        // Let's build a dynamic "modification" map.

        const lastChar = preCursor.slice(-1); // The char just typed (Latin)
        const prevChar = preCursor.slice(-2, -1); // The char before it (could be Ge'ez or Latin)

        // 1. Is the typed char a Vowel?
        if (isVowel(lastChar)) {
            // Try to modify previous Ge'ez char
            const combined = combine(prevChar, lastChar);
            if (combined) {
                // Replace [prevChar + lastChar] with [combined]
                processedPreCursor = preCursor.slice(0, -2) + combined;
            } else {
                // Maybe it's a standalone vowel mapping?
                const standalone = geezMap[lastChar];
                if (standalone) {
                    processedPreCursor = preCursor.slice(0, -1) + standalone;
                }
            }
        } else {
            // Consonant or other
            // Check for Consonant + Consonant combination (e.g. s + h = sh)
            const combined = combineConsonants(prevChar, lastChar); // returns 'ሽ' (she 6th) id prev='ስ' and curr='h'

            if (combined) {
                processedPreCursor = preCursor.slice(0, -2) + combined;
            } else {
                // Just map the single consonant to its 6th order
                const mapped = geezMap[lastChar];
                if (mapped) {
                    processedPreCursor = preCursor.slice(0, -1) + mapped;
                }
            }
        }

        // If the string changed, update
        if (processedPreCursor !== preCursor) {
            onChange(processedPreCursor + postCursor);
            // We need to manage cursor position ideally, but React's state update might jump it.
            // For now, let's rely on standard behavior, usually cursor stays at end of insertion.
            // If we shortened the string (2 chars -> 1 char), we might need to adjust.
            // The inputRef can be used to setSelectionRange if needed.
        } else {
            onChange(newValue);
        }

    }, [enabled, onChange, value]);

    return { handleChange, inputRef };
};

// Helper functions for the logic above

const isVowel = (char: string) => /^[aeiou]$/i.test(char);

// Reverse map for 6th order consonants to their Latin base (approximated for lookup)
// This is tricky because mapping is many-to-one sometimes.
// simpler: 'ስ' -> 's', 'ህ' -> 'h'
const baseMap: { [key: string]: string } = {};
// Initialize baseMap from geezMap where value is 6th order (usually ends in just the consonant or 'e' depending on the map, but in our map file:
// s -> ስ
// m -> ም
// etc.
// But wait, our geezMap has 'se' -> 'ሰ', 's' -> 'ስ'.
// So if we have 'ስ', we know it represents 's'.

// Let's populate baseMap dynamically
Object.entries(geezMap).forEach(([k, v]) => {
    // We are interested in single letters usually mapping to 6th order
    if (k.length === 1 && !isVowel(k)) {
        baseMap[v] = k;
    }
    // Also handle 'sh', 'ch', 'ny', 'gn' etc mapping to their 6th order
    // sh -> ሽ
    if (!isVowel(k.slice(-1)) && k.length > 1) {
        baseMap[v] = k;
    }
});

// Manual overrides for stability if needed
baseMap['ሽ'] = 'sh';
baseMap['ች'] = 'ch';
baseMap['ኝ'] = 'ny';
baseMap['ኘ'] = 'nye'; // wait, ኘ is 1st order. ኝ is 6th.
// The map has: 'ny': 'ኝ', 'nye': 'ኘ'. Consistent.

const combine = (prevChar: string, vowel: string): string | null => {
    // Get the Latin base for the previous Ge'ez char
    const base = baseMap[prevChar];

    // 1. Try base + vowel
    if (base && geezMap[base + vowel]) return geezMap[base + vowel];

    // 2. Fallback: Find any key in geezMap that produced prevChar
    // This is needed for keys that aren't in baseMap (e.g. uppercase vowels used as bases like 'I' -> 'ዒ')
    const key = Object.keys(geezMap).find(k => geezMap[k] === prevChar);
    if (key) {
        if (geezMap[key + vowel]) return geezMap[key + vowel];
    }

    return null;
}

const combineConsonants = (prevChar: string, consonant: string): string | null => {
    // e.g. prev='ስ' (s), cons='h' -> 'sh' -> 'ሽ'
    const base = baseMap[prevChar];
    if (!base) return null;

    if (geezMap[base + consonant]) return geezMap[base + consonant];
    return null;
}
