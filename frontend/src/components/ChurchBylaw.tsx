import React, { useEffect, useRef, useState } from 'react';
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
            let baseSlug = text.toLowerCase()
              .replace(/[`~!@#$%^&*()+=|{}\[\]:;"'<>?,./\\]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-');

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
      {/* Header Bar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-30 h-16 flex items-center px-4 md:px-8 justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden text-gray-600 hover:text-gray-900 focus:outline-none"
          >
            <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          </button>
          <h1 className="text-xl font-bold text-gray-800 hidden sm:block">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedLanguage('en')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${selectedLanguage === 'en' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              EN
            </button>
            <button
              onClick={() => setSelectedLanguage('ti')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${selectedLanguage === 'ti' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              TI
            </button>
          </div>
          {/* Print Button */}
          <button onClick={() => window.print()} className="p-2 text-gray-500 hover:text-primary-700 transition" title="Print">
            <i className="fas fa-print"></i>
          </button>
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
          <div className="p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Table of Contents</h3>
            <nav className="space-y-1">
              {toc.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`
                                    w-full text-left block px-3 py-2 rounded-md text-sm transition-colors duration-200
                                    ${item.level === 1 ? 'font-semibold mt-4' : 'ml-3 font-normal'}
                                    ${activeId === item.id
                      ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                `}
                >
                  {item.text}
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
            {/* Document Header */}
            <div className="mb-10 text-center border-b pb-8">
              <div className="w-20 h-20 mx-auto mb-6">
                <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain opacity-80" onError={(e) => e.currentTarget.style.display = 'none'} />
              </div>
              <h1 className="text-3xl md:text-5xl font-serif font-bold text-gray-900 mb-4">{title}</h1>
              <p className="text-lg text-gray-600 font-serif italic">{subtitle}</p>
            </div>

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
                      const text = props.children?.toString() || '';
                      const id = text.toLowerCase()
                        .replace(/[`~!@#$%^&*()+=|{}\[\]:;"'<>?,./\\]/g, '')
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-');
                      return <h1 id={id} className="scroll-mt-24 text-primary-800 border-b-2 border-primary-100 pb-4 mb-8 mt-12" {...props} />;
                    },
                    h2: ({ node, ...props }) => {
                      const text = props.children?.toString() || '';
                      const id = text.toLowerCase()
                        .replace(/[`~!@#$%^&*()+=|{}\[\]:;"'<>?,./\\]/g, '')
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-');
                      return <h2 id={id} className="scroll-mt-24 text-primary-700 mt-10 mb-6" {...props} />;
                    },
                    h3: ({ node, ...props }) => <h3 className="text-gray-800 font-bold mt-8 mb-4" {...props} />,
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
                    a: ({ node, ...props }) => <a {...props} className="text-primary-600 hover:text-primary-800 hover:underline" />
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