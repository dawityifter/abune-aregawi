import { transliterate } from './geezTransliteration';

// A strict mapping for common names that phonetic engines often transliterate awkwardly.
// Always use lowercase as the key for case-insensitive matching.
const knownNamesDict: Record<string, string> = {
    'dawit': 'ዳዊት',
    'yifter': 'ይፍጠር',
    'abune': 'አቡነ',
    'aregawi': 'አረጋዊ',
    'tsegaye': 'ጸጋዬ',
    'alem': 'ዓለም',
    'kidane': 'ኪዳነ',
    'mariam': 'ማርያም',
    'michael': 'ሚካኤል',
    'gabriel': 'ገብርኤል',
    'yonas': 'ዮናስ',
    'sara': 'ሣራ',
    'solomon': 'ሰሎሞን',
    'mekonnen': 'መኮንን',
    'yosef': 'ዮሴፍ',
    'hailu': 'ኃይሉ',
    'tecle': 'ተክለ',
    'giorgis': 'ጊዮርጊስ',
    'abraham': 'አብርሃም',
    'isaac': 'ይስሐቅ',
    'yacob': 'ያዕቆብ',
    'meskel': 'መስቀል',
    'awash': 'አዋሽ'
};

/**
 * Phonetic normalizations specifically designed to bridge Anglophone Ethiopian spellings
 * to the `geezTransliteration.ts` engine which expects strict phonetic pairs.
 */
const normalizeForPhoneticEngine = (name: string): string => {
    let normalized = name;

    // Replace suffix "er" with phonetic target "er" -> "e" + "r"
    // For standard geez transliteration engine, 'e' gives 1st order.
    // Actually, 'er' -> 'እር' if isolated, but usually follows consonant.

    // Example adjustments to force correct orders in `transliterate()`
    // Often double consonants aren't handled well unless intended
    // 'sh' -> 'ሽ' is handled by geezMap.
    // 'ch' -> 'ች' is handled by geezMap.

    return normalized;
};

/**
 * Translates/Transliterates an English name string into Tigrinya script.
 * @param fullName The full name in English to translate
 * @returns The converted full name in Tigrinya
 */
export const englishNameToTigrinya = (fullName: string): string => {
    if (!fullName) return '';

    return fullName
        .split(' ')
        .map(word => {
            // 1. Clean the word from punctuation to look it up accurately
            const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();

            // 2. Exact Dictionary Match
            if (knownNamesDict[cleanWord]) {
                return knownNamesDict[cleanWord];
            }

            // 3. Fallback to Dynamic Transliteration Engine
            // Normalize english spellings to phonetic spellings our transliterate() understands
            const normalizedWord = normalizeForPhoneticEngine(word.toLowerCase());
            return transliterate(normalizedWord);
        })
        .join(' ');
};
