import { englishNameToTigrinya } from '../nameTransliteration';

describe('nameTransliteration', () => {
    describe('englishNameToTigrinya', () => {
        it('returns empty string for empty input', () => {
            expect(englishNameToTigrinya('')).toBe('');
            expect(englishNameToTigrinya(null as any)).toBe('');
            expect(englishNameToTigrinya(undefined as any)).toBe('');
        });

        it('translates predefined dictionary names correctly', () => {
            expect(englishNameToTigrinya('Dawit')).toBe('ዳዊት');
            expect(englishNameToTigrinya('yifter')).toBe('ይፍጠር');
            expect(englishNameToTigrinya('Abune Aregawi')).toBe('አቡነ አረጋዊ');
            expect(englishNameToTigrinya('yosef michael')).toBe('ዮሴፍ ሚካኤል');
        });

        it('handles mixed case in predefined dictionary names', () => {
            expect(englishNameToTigrinya('DaWiT yiFtEr')).toBe('ዳዊት ይፍጠር');
        });

        it('falls back to transliteration engine for unknown names', () => {
            // "kebede" is not in the dictionary, so it should fall back to standard phonetics
            // 'k' + 'e' -> 'ከ', 'b' + 'e' -> 'በ', 'd' + 'e' -> 'ደ'
            expect(englishNameToTigrinya('kebede')).toBe('ከበደ');
        });

        it('handles mixed known and unknown words', () => {
            // "Dawit" is known, "kebede" is unknown
            expect(englishNameToTigrinya('Dawit kebede')).toBe('ዳዊት ከበደ');
        });

        it('ignores punctuation during dictionary lookup', () => {
            // Testing with a trailing space or punctuation equivalent (though it splits by space, let's just test general robustness)
            expect(englishNameToTigrinya('Dawit.')).toBe('ዳዊት');
            expect(englishNameToTigrinya('Yifter,')).toBe('ይፍጠር');
        });
    });
});
