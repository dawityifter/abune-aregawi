import { slugifyHeading, buildHeadingIndex } from '../bylawSlugs';

describe('slugifyHeading', () => {
  it('lowercases, strips punctuation, and collapses whitespace to single hyphens', () => {
    expect(slugifyHeading('Article 1.0 — Name and Main Office')).toBe(
      'article-10-name-and-main-office'
    );
  });

  it('collapses runs of hyphens produced by removed punctuation', () => {
    expect(slugifyHeading('Records  —  Reports')).toBe('records-reports');
  });

  it('preserves Ethiopic script so Tigrigna headings do not collapse to "-"', () => {
    const slug = slugifyHeading('ዓንቀጽ 1.0 — ስምን ቀንዲ ቤት ጽሕፈትን');
    expect(slug).toBe('ዓንቀጽ-10-ስምን-ቀንዲ-ቤት-ጽሕፈትን');
    expect(slug).not.toBe('-');
  });

  it('keeps a meaningful internal hyphen inside a compound Tigrigna heading', () => {
    // The paren group is stripped; the hyphen in ስነ-ስርዓት stays.
    expect(slugifyHeading('ዓንቀጽ 15.0 — ስጉምቲ ስነ-ስርዓት')).toBe(
      'ዓንቀጽ-150-ስጉምቲ-ስነ-ስርዓት'
    );
  });
});

describe('buildHeadingIndex', () => {
  it('extracts H1 and H2 headings but not H3', () => {
    const md = ['# Title', '', '## Section', '', '### Subsection'].join('\n');
    const { toc } = buildHeadingIndex(md);
    expect(toc).toEqual([
      { id: 'title', text: 'Title', level: 1 },
      { id: 'section', text: 'Section', level: 2 },
    ]);
  });

  it('de-duplicates repeated slugs with numeric suffixes', () => {
    const md = ['## Discipline', '', '## Discipline', '', '## Discipline'].join('\n');
    const { toc } = buildHeadingIndex(md);
    expect(toc.map((t) => t.id)).toEqual([
      'discipline',
      'discipline-1',
      'discipline-2',
    ]);
  });

  it('maps every heading source line to the SAME unique id used in the TOC', () => {
    const md = [
      '# Title', // line 1
      '', // 2
      '## Discipline', // 3
      '', // 4
      '## Discipline', // 5
    ].join('\n');
    const { toc, idByLine } = buildHeadingIndex(md);
    // TOC and per-line ids must never diverge — this is what keeps a rendered
    // <h2 id> aligned with the anchor its TOC link points at.
    expect(idByLine[1]).toBe(toc[0].id);
    expect(idByLine[3]).toBe(toc[1].id);
    expect(idByLine[5]).toBe(toc[2].id);
    expect(idByLine[3]).not.toBe(idByLine[5]);
  });

  it('produces non-empty, distinct ids for Ethiopic headings', () => {
    const md = ['## ዓንቀጽ 5.0 — ኣባልነት', '', '## ዓንቀጽ 6.0 — ሓፈሻዊ ጉባኤን'].join('\n');
    const { idByLine } = buildHeadingIndex(md);
    expect(idByLine[1]).toBe('ዓንቀጽ-50-ኣባልነት');
    expect(idByLine[3]).toBe('ዓንቀጽ-60-ሓፈሻዊ-ጉባኤን');
  });
});
