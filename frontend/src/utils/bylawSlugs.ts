// Slug/anchor helpers for the rendered church bylaws.
//
// The bylaws page builds a Table of Contents from the raw markdown and also
// renders each heading with an `id` for in-page anchor navigation. Both must
// agree on the *same* id for every heading — otherwise a TOC link points at an
// anchor that doesn't exist. `buildHeadingIndex` computes both in one pass and
// keys the per-heading id by source line so the render layer can look up the
// exact id without re-deriving (and re-diverging from) the de-dup logic.

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface HeadingIndex {
  toc: TocItem[];
  /** 1-based markdown source line -> unique heading id. */
  idByLine: Record<number, string>;
}

// Keep ASCII word chars, whitespace, hyphens, and the Ethiopic script blocks
// (Ethiopic, Supplement, Extended, Extended-A) so Tigrigna headings produce
// non-empty, unique anchor ids instead of collapsing to "-".
export const slugifyHeading = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\w\sሀ-፿ᎀ-᎟ⶀ-⷟꬀-꬯-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const H1 = /^#\s+(.+)$/;
const H2 = /^##\s+(.+)$/;

export const buildHeadingIndex = (markdown: string): HeadingIndex => {
  const toc: TocItem[] = [];
  const idByLine: Record<number, string> = {};
  const slugCounts: Record<string, number> = {};

  markdown.split('\n').forEach((line, i) => {
    const h1 = line.match(H1);
    const h2 = h1 ? null : line.match(H2);
    if (!h1 && !h2) return;

    const text = (h1 ? h1[1] : h2![1]).trim();
    const level = h1 ? 1 : 2;

    let id = slugifyHeading(text);
    slugCounts[id] = (slugCounts[id] || 0) + 1;
    if (slugCounts[id] > 1) {
      id = `${id}-${slugCounts[id] - 1}`;
    }

    toc.push({ id, text, level });
    idByLine[i + 1] = id; // markdown source lines are 1-based
  });

  return { toc, idByLine };
};
