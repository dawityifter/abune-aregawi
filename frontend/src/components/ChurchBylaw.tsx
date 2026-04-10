import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Helper interface for TOC items
interface TocItem {
  id: string;
  text: string;
  level: number;
}

const slugifyHeading = (value: string) =>
  value.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const getNodeText = (children: React.ReactNode): string =>
  React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }
      if (React.isValidElement(child)) {
        return getNodeText((child.props as { children?: React.ReactNode }).children);
      }
      return '';
    })
    .join('')
    .trim();

const ChurchBylaw: React.FC = () => {
  const { currentLanguage, setLanguage } = useLanguage();

  // Local state for fetching and UI
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar toggle

  // Use global language state
  const selectedLanguage = currentLanguage;
  const setSelectedLanguage = setLanguage;

  // Load Bylaws
  useEffect(() => {
    setLoading(true);
    setError(null);
    const file = selectedLanguage === 'en' ? 'bylaws/Bylaws-en.md' : 'bylaws/Bylaws-ti.md';

    fetch(`${process.env.PUBLIC_URL || ''}/${file}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load bylaws (status ${res.status})`);
        return res.text();
      })
      .then((text) => {
        setMarkdownContent(text);
        // Generate TOC from text content (rough regex approach is faster than parsing AST client-side for this scale)
        const lines = text.split('\n');
        const extractedToc: TocItem[] = [];
        const slugCounts: Record<string, number> = {};

        lines.forEach(line => {
          // Match H1 (# ) and H2 (## )
          const h1Match = line.match(/^#\s+(.+)$/);
          const h2Match = line.match(/^##\s+(.+)$/);

          if (h1Match || h2Match) {
            const text = h1Match ? h1Match[1].trim() : h2Match![1].trim();
            const level = h1Match ? 1 : 2;

            // Generate ID
            let baseSlug = slugifyHeading(text);

            // Handle Duplicate IDs
            slugCounts[baseSlug] = (slugCounts[baseSlug] || 0) + 1;
            if (slugCounts[baseSlug] > 1) {
              baseSlug = `${baseSlug}-${slugCounts[baseSlug] - 1}`;
            }

            extractedToc.push({ id: baseSlug, text, level });
          }
        });
        setToc(extractedToc);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedLanguage]);

  // Scroll Spy to highlight active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-10% 0px -80% 0px' }
    );

    const headings = document.querySelectorAll('h1[id], h2[id]');
    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, [markdownContent]);

  // Handle Hash Navigation
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveId(id);
      setIsSidebarOpen(false); // Close mobile sidebar on selection
    }
  };

  const title = selectedLanguage === 'en' ? 'Church Bylaws' : 'ሕጊ ቤተ ክርስቲያን';
  const subtitle = selectedLanguage === 'en' ? 'Administrative Guidelines & Structure' : 'ስርዓተ ምልክን መምርሒታትን';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Compact Sticky Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 h-14 flex items-center px-4 md:px-8 justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden text-gray-500 hover:text-gray-800 focus:outline-none"
            aria-label="Toggle navigation"
          >
            <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars'} text-lg`}></i>
          </button>
          <span className="text-sm font-semibold text-gray-700 hidden sm:inline">{title}</span>
          {activeId && (
            <span className="text-sm text-gray-400 hidden sm:inline">
              › {toc.find(t => t.id === activeId)?.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedLanguage('en')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${selectedLanguage === 'en' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
            >EN</button>
            <button
              onClick={() => setSelectedLanguage('ti')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${selectedLanguage === 'ti' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
            >TI</button>
          </div>
          <button onClick={() => window.print()} className="p-2 text-gray-400 hover:text-primary-700 transition" title="Print">
            <i className="fas fa-print text-sm"></i>
          </button>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="hidden md:inline text-xs text-gray-400 hover:text-gray-700 transition ml-1"
          >↑ Top</button>
        </div>
      </div>

      {/* Hero Banner */}
      <div
        className="relative overflow-hidden py-10 px-6 text-center"
        style={{ background: 'linear-gradient(160deg, #7f1d1d 0%, #991b1b 60%, #78350f 100%)' }}
      >
        {/* Dot texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.07,
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        />
        <div className="relative z-10">
          <p
            className="text-xs font-semibold uppercase mb-3"
            style={{ color: '#fbbf24', letterSpacing: '2.5px' }}
          >
            Abune Aregawi Orthodox Tewahedo Church &middot; Garland, TX
          </p>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-2 tracking-wide">
            {title}
          </h1>
          <p className="text-base font-serif italic mb-5" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {subtitle}
          </p>
          {/* Gold divider */}
          <div
            className="mx-auto mb-5 h-px w-16 rounded"
            style={{ background: 'linear-gradient(to right, transparent, #fbbf24, transparent)' }}
          />
          {/* Language + Print pills */}
          <div className="flex justify-center items-center gap-4 flex-wrap">
            <button
              onClick={() => setSelectedLanguage('en')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                selectedLanguage === 'en'
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-transparent border-white/20 text-white/50 hover:text-white/75'
              }`}
            >EN</button>
            <button
              onClick={() => setSelectedLanguage('ti')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                selectedLanguage === 'ti'
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-transparent border-white/20 text-white/50 hover:text-white/75'
              }`}
            >TI</button>
            <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <button
              onClick={() => window.print()}
              className="rounded-full px-4 py-1.5 text-xs font-semibold border border-white/20 text-white/50 hover:text-white/75 transition-all"
            >⎙ Print</button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto md:flex relative">

        {/* Sidebar (Desktop: Sticky, Mobile: Fixed Overlay) */}
        <aside
          className={`
                    fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-white border-r border-gray-200 overflow-y-auto z-20 transition-transform duration-300 ease-in-out
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                 `}
        >
          <div className="px-4 pt-6 pb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Table of Contents</h3>
            <nav className="space-y-0.5">
              {toc.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={[
                    'w-full text-left flex items-center gap-2 rounded-md transition-colors duration-150',
                    item.level === 1
                      ? 'px-2 py-1.5 text-sm font-semibold mt-3'
                      : 'pl-5 pr-2 py-1 text-xs',
                    activeId === item.id
                      ? 'bg-primary-50 text-primary-800'
                      : item.level === 1
                        ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600',
                  ].join(' ')}
                >
                  {item.level === 1 && (
                    <span
                      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-150 ${
                        activeId === item.id ? 'bg-primary-600' : 'bg-transparent'
                      }`}
                    />
                  )}
                  <span className="truncate">{item.text}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-10 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-12 lg:p-16 min-h-screen bg-white md:ml-0">
          <div className="max-w-4xl mx-auto">
              {/* Content Body */}
            <article className="prose md:prose-lg lg:prose-xl prose-primary max-w-none text-gray-700 leading-relaxed font-serif">
              {loading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                  Error loading document. Please try refreshing.
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    h1: ({ node, ...props }) => {
                      // Generate ID for auto-linking
                      const text = getNodeText(props.children);
                      const id = slugifyHeading(text);
                      return (
                        <h1 id={id || undefined} className="scroll-mt-24 text-primary-800 border-b-2 border-primary-100 pb-4 mb-8 mt-12">
                          {props.children}
                        </h1>
                      );
                    },
                    h2: ({ node, ...props }) => {
                      const text = getNodeText(props.children);
                      const id = slugifyHeading(text);
                      return (
                        <h2 id={id || undefined} className="scroll-mt-24 text-primary-700 mt-10 mb-6">
                          {props.children}
                        </h2>
                      );
                    },
                    h3: ({ node, ...props }) => (
                      <h3 className="text-gray-800 font-bold mt-8 mb-4">
                        {props.children}
                      </h3>
                    ),
                    ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-2 mb-6" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-2 mb-6" {...props} />,
                    li: ({ node, ...props }) => <li className="pl-2" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-6 text-gray-700" {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-amber-400 bg-amber-50 p-4 italic my-6 rounded-r-lg" {...props} />,
                    // Handle images (like signatures or logos embedded in md)
                    img: ({ node, ...props }) => (
                      <div className="flex justify-center my-8">
                        <img {...props} className="max-h-96 rounded shadow-lg border" alt={props.alt || 'Bylaw illustration'} />
                      </div>
                    ),
                    a: ({ node, ...props }) => (
                      <a
                        {...props}
                        className="text-primary-600 hover:text-primary-800 hover:underline"
                        aria-label={getNodeText(props.children) || props.href || 'Bylaw link'}
                      >
                        {props.children || props.href}
                      </a>
                    )
                  }}
                >
                  {markdownContent}
                </ReactMarkdown>
              )}
            </article>

            {/* Footer Signature Area (Static Placeholder) */}
            {!loading && !error && (
              <div className="mt-20 pt-10 border-t border-gray-200 text-center">
                <div className="flex justify-center mb-6">
                  <i className="fas fa-church text-4xl text-gray-300"></i>
                </div>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Official Document of Abune Aregawi Orthodox Tewahedo Church</p>
                <p className="text-xs text-gray-400 mt-2">Garland, Texas</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChurchBylaw; 
