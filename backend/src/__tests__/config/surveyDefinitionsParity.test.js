const fs = require('fs');
const path = require('path');
const { SURVEY_SLUG, SURVEY_DEFINITIONS } = require('../../config/surveyDefinitions/churchServicesAssessment2026');

// The 56-question survey is defined twice — once here for server-side validation
// and once in the frontend wizard — and the two arrays are maintained by hand.
// If they drift (a renamed optionKey, a changed maxSelect, a question moved to
// another section), the wizard happily collects answers the server then rejects
// with a 400, and the respondent loses everything they typed. This test reads the
// TypeScript definition as text and compares it structurally to the JS config so
// that drift fails CI instead of production.
//
// Deliberately not a general TS parser: the frontend array is a flat list of
// simple object literals with string/number/string[] values, so a targeted
// literal extraction plus JSON.parse is enough and adds no new dependency.

const TS_PATH = path.join(__dirname, '../../../../frontend/src/components/survey/surveyDefinitions.ts');

const KNOWN_FIELDS = ['id', 'section', 'type', 'optionKeys', 'otherOptionKey', 'maxSelect'];

function extractArrayLiteral(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find "${startMarker}" in ${TS_PATH}`);
  // Anchor on the assignment's opening bracket, not the first '[' after the
  // marker — the type annotation (SurveyQuestionDef[]) contains one too.
  const assign = source.indexOf('= [', start);
  const open = assign === -1 ? -1 : assign + 2;
  const close = source.indexOf('\n];', open);
  if (open === -1 || close === -1) throw new Error(`Could not delimit the array literal after "${startMarker}"`);
  return source.slice(open, close + 2);
}

function literalToJson(literal) {
  return JSON.parse(
    literal
      // Bare identifier keys -> quoted JSON keys.
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      // Single-quoted strings -> double-quoted. Safe here: no value in either
      // definition contains a quote or apostrophe (ids and optionKeys are
      // camelCase identifiers).
      .replace(/'/g, '"')
      // Trailing commas before a closing bracket/brace.
      .replace(/,(\s*[\]}])/g, '$1')
  );
}

function normalize(q) {
  return {
    id: q.id,
    section: q.section,
    type: q.type,
    optionKeys: q.optionKeys || null,
    otherOptionKey: q.otherOptionKey || null,
    maxSelect: q.maxSelect || null
  };
}

describe('survey definition parity: backend JS config vs frontend TS definitions', () => {
  const backendQuestions = SURVEY_DEFINITIONS[SURVEY_SLUG].questions;
  const tsSource = fs.readFileSync(TS_PATH, 'utf8');
  const frontendQuestions = literalToJson(
    extractArrayLiteral(tsSource, 'export const SURVEY_QUESTIONS')
  );

  it('parsed the frontend definitions at all (guards against a silent extraction failure)', () => {
    expect(Array.isArray(frontendQuestions)).toBe(true);
    expect(frontendQuestions.length).toBeGreaterThan(50);
    expect(frontendQuestions[0]).toMatchObject({ id: 'q1', section: 1, type: 'single' });
  });

  it('declares the same number of questions on both sides', () => {
    expect(frontendQuestions).toHaveLength(backendQuestions.length);
  });

  it('uses only fields this test knows how to compare', () => {
    // If either side gains a new field (e.g. minSelect), this fails so the
    // comparison below can be extended rather than silently ignoring it.
    const unexpected = [];
    [...backendQuestions, ...frontendQuestions].forEach(q => {
      Object.keys(q).forEach(field => {
        if (!KNOWN_FIELDS.includes(field)) unexpected.push(`${q.id}.${field}`);
      });
    });
    expect(unexpected).toEqual([]);
  });

  it('matches question-by-question on id, section, type, optionKeys, otherOptionKey and maxSelect', () => {
    expect(frontendQuestions.map(normalize)).toEqual(backendQuestions.map(normalize));
  });

  it('agrees with the frontend SURVEY_SLUG and SURVEY_SECTION_COUNT', () => {
    const slugMatch = tsSource.match(/export const SURVEY_SLUG = '([^']+)'/);
    const sectionCountMatch = tsSource.match(/export const SURVEY_SECTION_COUNT = (\d+)/);
    expect(slugMatch && slugMatch[1]).toBe(SURVEY_SLUG);

    const highestSection = Math.max(...backendQuestions.map(q => q.section));
    expect(Number(sectionCountMatch && sectionCountMatch[1])).toBe(highestSection);
  });
});
