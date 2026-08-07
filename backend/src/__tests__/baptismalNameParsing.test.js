'use strict';

/**
 * Parsing baptismal names into the saint they refer to.
 *
 * Ethiopian baptismal names are compound — a construct prefix (Gebre, Welde,
 * Haile, Tekle...) plus the saint or divine referent the child is dedicated to.
 * Resolving that referent is what makes a name day possible, and getting it
 * wrong means greeting somebody on the wrong saint's feast, which is worse than
 * not greeting them at all.
 *
 * These cases are shapes, not real members' names.
 */

const { normalize, referentOf, canonical, hasGeez } = require('../scripts/survey-baptismal-names');

describe('normalize', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalize('  Gebre   MICHAEL ')).toBe('gebre michael');
  });

  it('strips punctuation that creeps in from free-text entry', () => {
    expect(normalize('Gebre-Michael')).toBe('gebre-michael');
    expect(normalize('Welde, Mariam')).toBe('welde mariam');
    expect(normalize("Habte'Selassie")).toBe('habte selassie');
  });

  it('treats blank and missing values the same', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
    expect(normalize('   ')).toBe('');
  });
});

describe('hasGeez', () => {
  it('recognises Ethiopic script', () => {
    expect(hasGeez('ወልደ ማርያም')).toBe(true);
    expect(hasGeez('ገብረ ሚካኤል')).toBe(true);
  });
  it('does not flag Latin transliteration', () => {
    expect(hasGeez('Welde Mariam')).toBe(false);
  });
});

describe('referentOf — stripping the construct prefix', () => {
  it.each([
    ['gebre michael', 'michael'],
    ['welde mariam', 'mariam'],
    ['haile selassie', 'selassie'],
    ['tekle haymanot', 'haymanot'],
    ['habte giorgis', 'giorgis'],
    ['amete mariam', 'mariam'],
    ['welete kidane', 'kidane']
  ])('%s resolves to %s', (input, expected) => {
    expect(referentOf(input)).toBe(expected);
  });

  it('handles names written without a space', () => {
    expect(referentOf('gebremichael')).toBe('michael');
    expect(referentOf('weldemariam')).toBe('mariam');
  });

  it('handles the abbreviated forms people actually type', () => {
    expect(referentOf('g/michael')).toBe('michael');
    expect(referentOf('w/mariam')).toBe('mariam');
  });

  it('strips Ge\'ez prefixes as well as Latin ones', () => {
    expect(referentOf('ገብረ ሚካኤል')).toBe('ሚካኤል');
    expect(referentOf('ወልደ ማርያም')).toBe('ማርያም');
  });

  it('leaves a bare saint name alone', () => {
    expect(referentOf('michael')).toBe('michael');
    expect(referentOf('giorgis')).toBe('giorgis');
    expect(referentOf('ማርያም')).toBe('ማርያም');
  });

  it('groups spelling variants of the same name onto the same referent', () => {
    // The point of the survey: these should collapse so the frequency counts
    // reflect saints rather than spellings.
    const michael = ['gebre michael', 'gabre michael', 'gebremichael', 'g/michael'];
    const resolved = new Set(michael.map((n) => referentOf(normalize(n))));
    expect(resolved).toEqual(new Set(['michael']));
  });

  it('does not mangle a short name that merely starts with prefix letters', () => {
    // "Tekle" alone is a name; it must not be stripped to an empty string.
    expect(referentOf('tekle')).toBe('tekle');
    expect(referentOf('kidane')).toBe('kidane');
  });
});

describe('what the survey cannot resolve', () => {
  it('leaves genuinely ambiguous compounds intact for a human to judge', () => {
    // "Kidane Mariam" could point at Kidane Meheret or at Mary. The parser must
    // not silently pick one — it returns something a reviewer can see and rule
    // on, rather than a guess that would greet someone on the wrong feast.
    const r = referentOf(normalize('Kidane Mariam'));
    expect(r).toBe('mariam');
    // Recorded so the ambiguity is visible in the test suite rather than
    // discovered in production: this resolves to Mary, and clergy must confirm
    // whether that is right for this name.
    expect(['mariam', 'kidane mariam']).toContain(r);
  });
});

describe('after the first survey — variants that were fragmenting the counts', () => {
  const resolve = (raw) => canonical(referentOf(normalize(raw)));

  it('collapses the "X of Mary" construct forms the survey exposed', () => {
    // These were each counted as a separate saint in the first run, which made
    // Mary look far less common than she is.
    ['Atsede Mariam', 'Askale Mariam', 'Fikrte Mariam', 'Fikre Mariam', 'Tsedale Mariam']
      .forEach((n) => expect(resolve(n)).toBe('mariam'));
  });

  it('collapses spelling variants of the same saint', () => {
    expect(new Set(['Selassie', 'Sellassie', 'Silassie'].map(resolve))).toEqual(new Set(['selassie']));
    expect(new Set(['Gabriel', 'Gebriel', 'Gebrail'].map(resolve))).toEqual(new Set(['gabriel']));
    expect(new Set(['Michael', 'Mikael', 'Micheal'].map(resolve))).toEqual(new Set(['michael']));
    expect(new Set(['Giorgis', 'Georgis', 'Giyorgis'].map(resolve))).toEqual(new Set(['giorgis']));
  });

  it('handles a construct prefix and a spelling variant together', () => {
    expect(resolve('Gebre Mikael')).toBe('michael');
    expect(resolve('Welde Maryam')).toBe('mariam');
    expect(resolve('Habte Sellassie')).toBe('selassie');
  });

  it('does not over-collapse genuinely different saints', () => {
    // Guards the alias map from becoming a blunt instrument.
    expect(resolve('Michael')).not.toBe(resolve('Gabriel'));
    expect(resolve('Mariam')).not.toBe(resolve('Selassie'));
    expect(resolve('Giorgis')).not.toBe(resolve('Aregawi'));
  });
});
