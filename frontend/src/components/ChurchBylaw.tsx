import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

const ChurchBylaw: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ti'>(currentLanguage);

  // Load English bylaws from public markdown
  const [englishMd, setEnglishMd] = useState<string>('');
  const [tigrinyaMd, setTigrinyaMd] = useState<string>('');
  const [loadingMd, setLoadingMd] = useState<boolean>(false);
  const [mdError, setMdError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hasPdf, setHasPdf] = useState<boolean>(false);

  useEffect(() => {
    setLoadingMd(true);
    setMdError(null);
    const file = selectedLanguage === 'en' ? 'bylaws/Bylaws-en.md' : 'bylaws/Bylaws-ti.md';
    fetch(`${process.env.PUBLIC_URL || ''}/${file}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load bylaws (status ${res.status})`);
        const lm = res.headers.get('last-modified');
        if (lm) {
          try {
            const dt = new Date(lm);
            setLastUpdated(dt.toLocaleString());
          } catch {}
        } else {
          setLastUpdated(null);
        }
        return res.text();
      })
      .then((txt) => {
        if (selectedLanguage === 'en') setEnglishMd(txt);
        else setTigrinyaMd(txt);
      })
      .catch((err) => setMdError(err.message || 'Failed to load bylaws'))
      .finally(() => setLoadingMd(false));
  }, [selectedLanguage]);

  // Shared slugify and child-text extractor so heading IDs match TOC
  const slugCountsRef = useRef<Record<string, number>>({});
  const slugify = (s: string) => {
    const base = s
      .trim()
      .toLowerCase()
      .replace(/[`~!@#$%^&*()+=|{}\[\]:;"'<>?,./\\]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    const count = (slugCountsRef.current[base] = (slugCountsRef.current[base] || 0) + 1);
    return count > 1 ? `${base}-${count - 1}` : base;
  };
  const textFromChildren = (children: React.ReactNode): string => {
    let out = '';
    React.Children.forEach(children as any, (child: any) => {
      if (typeof child === 'string') out += child;
      else if (typeof child === 'number') out += String(child);
      else if (child && child.props && child.props.children) out += textFromChildren(child.props.children);
    });
    return out;
  };

  // English content loaded from markdown; Tigrinya stays inline for now

  const tigrinyaBylaws = {
    title: "ሕጊ ቤተ ክርስቲያን",
    subtitle: "ኣቡነ ኣረጋዊ ኦርቶዶክስ ተዋህዶ ቤተ ክርስቲያን - ስርዓተ ምድማርን መምርሒታትን",
    sections: [
      {
        title: "1. ርእሰ ጉባኤ (ፕረዚደንት)",
        items: [
          "1.1 ተግባር ርእሰ ጉባኤ እቲ ኮሚተ ብወግዓዊ ሕጊ እዚ ብዝተወሰነ መምርሒታት ምእራም እዩ።",
          "1.2 ርእሰ ጉባኤ ንኹሎም ኣኼባታት ብመሰረት እዚ ሕጊ እዚ ይመርሖም።",
          "1.3 ንኹሎም ኣኼባታት ኣጀንዳ ይዳሎ ከምኡውን ኣባላት ናብ ልሙድ ከምኡውን ፍሉይ ኣኼባታት እዚ ዕላ ይጽውዖም።",
          "1.4 ኣብ ውዕል ምስ ካልኦት ተቋማት ንዘበና እታ ቤተ ክርስቲያን ኣብ ዝሓለፈሉ ውዕላት ወሳኒ እዚ ዕላ ካብ ሓበሻት ኣባላት ኮሚተ ፀብጻ ከምኡውን ፍቓድ ክረኽብ ኣለዎ።",
          "1.5 ኣብ ስብሰባ ማእከላይ ጉባኤ ኣብ ናይ እዚ ኮሚተ ኣቀማምጣ ወይ ጸብጻታት ክገልጽ ይኽእል እዩ።",
          "1.6 ከም ኵሉ ኣባል ኮሚተ እዚ ኸልኦ ሓደ ድምጺ ጥራይ ኣለዎ።",
          "1.7 ኵሎም ዝተዋህበ ምክራት ከምኡውን ዝተወሰኑ ተግባራት ክትፍጸሙ ይጠብቅ።"
        ]
      },
      {
        title: "2. ምክትል ርእሰ ጉባኤ (ቪስ ፕረዚደንት)",
        items: [
          "2.1 ኣብ ኣልቦነት ርእሰ ጉባኤ ን ተግባራቱ ይሰርሕ።",
          "2.2 ከም ኵሉ ኣባል ኮሚተ ሓደ ድምጺ ጥራይ ኣለዎ።",
          "2.3 ብግዜ ብግዜ ከም ዘሎዎ ዝኾነ ፍሉይ እዚ ረጋጅነት እዚ ይምደብ።"
        ]
      },
      {
        title: "3. ሓበሻይ ጸሓፊ (ጄነራል እዚ ከከረተሪ)",
        items: [
          "3.1 ኣብ ኵሎም ኣኼባታት ኮሚተ ከምኡውን ማእከላይ ጉባኤ ጸሓፊ ኮይኑ ይሰርሕ።",
          "3.2 ንዝተወሰኑ ውሳነታት ናይ ምፍጻም ምዕባለታት ክክትል ከምኡውን ጸብጻት ክገብር ይወሃቦ።",
          "3.3 ኵሎም ዝምልከቱ ዜናታት ናብ ኣባላት ቤተ ክርስቲያን ከምኡውን ኣባላት ኮሚተ ብቕልጡፍ ይሰዲዶም።",
          "3.4 ኣጀንዳ ኣኼባታት ይዳሎ ከምኡውን መዝገብ ኣኼባታት ኮሚተ ከምኡውን ማእከላይ ጉባኤ ይካየድ።",
          "3.5 ኣብ ኣልቦነት ርእሰ ጉባኤ ከምኡውን ምክትል ርእሰ ጉባኤ ንኣኼባታት ኮሚተ ይመርሕ።"
        ]
      },
      {
        title: "4. ሓለዋይ ኣካውንታንት (ቻይፍ ኣካውንታንት)",
        items: [
          "4.1 ብሕሱምነት: እዚ ሓለዋይ ኣካውንታንት ቀዳምነት ናይ ኣካውንቲን ፋይናንስን ብሕሱም ክህልዎ ኣለዎ። እንተዘይኮነ ግን፡ እቲ ኮሚተ ካብ ኣባላት ቤተ ክርስቲያን ኣብዚ መዳይ ዝሰለጠነ ተጋዳላይ ክሕግዞ ኣለዎ።",
          "4.2 እቲ ሓለዋይ ኣካውንታንት ኵሎም ንብረት ከምኡውን ዕዳታት ቤተ ክርስቲያን ብመሰረት ናይ ተቀባልነት ዘለዎም ኣካውንቲን ሕጋዊ መምርሒታት ይካየድ።",
          "4.3 ኣብ ክፍሊ ፋይናንስ ቤተ ክርስቲያን ግቡእ ናይ ውሽጣዊ ቁጠጣ ስርዓት ከም ዘሎ ይጠብቅ።",
          "4.4 ኵሎም ፋይናንሳዊ እዚ ሰነዳት ብኣጽቦትን ብተራ ኣብ ዝተወሰነ መዕቀኒ ንዝተፈላለዩ ሰበ ስልጣን ቤተ ክርስቲያን ከምኡውን ኣውዳውላት ንምርኣይ ይካየድ።",
          "4.5 ኵሎም ክፍሊታት ብግዜኡን ኣብ ዝተፈላለየ በጃት ከም ዝኽፈሉ ይረጋግጽ።",
          "4.6 ኵሎም ዝምልከቱ ክፍሊታት ከም ዝበጽሑ ከምኡውን ረሲት ከም እዚ ይሃቦም ይረጋግጽ።",
          "4.7 ኣብ ውሽጢ ዓመት ከምኡውን ዓመታዊ ፋይናንሳዊ ጸብጻታት ንማእከላይ ጉባኤ ንምቕራብ እዚ ይዳሎ።",
          "4.8 ኵሎም ዝምልከቱ ፋይናንሳዊ ሰነዳት ንኣውዳውላት ይዳሎ ከምኡውን ይህቦም።",
          "4.9 ናይ ኣውዳውላት ምክራት ብዛዕባ መጻሕፍቲ ኣካውንቲን ይፍጸም።",
          "4.10 ኵሎም ካራት ክፍሊት ከምኡውን ፋይናንሳዊ ውልታት ብዝተወሰኑ ምልክት ኣቕራብቲ ከም ዝፈረሙ ይረጋግጽ።",
          "4.11 ወርሓዊ ምልካእ ባንክ ይዳሎ ከምኡውን ንኮሚተ ንምግላጽ ከምኡውን ንምግባር ይህቦ።",
          "4.12 ምስ ርእሰ ኮሚተ ኣስተዳድርን ኣገልግሎትን ብምምኽናይ ዓመታዊ በጃት ንማእከላይ ጉባኤ ንምቕራብ ይዳሎ።",
          "4.13 ናይ ቤተ ክርስቲያን ኣበው ከምኡውን ገንዘብ ይዳሎ ከምኡውን ይቆጻጸር።"
        ]
      },
      {
        title: "5. ገንዘብ ሓላፊ (ትረዘረር)",
        items: [
          "5.1 እቲ ገንዘብ ሓላፊ ንመጻሕፍትን እዚ ሰነዳትን ቤተ ክርስቲያን ንምሕላውን ንምዕቃብን ይወሃቦ።",
          "5.2 ገንዘብ ከምኡውን ካራት ኣብ ባንክ ቤተ ክርስቲያን ኣብ ውሽጢ ሰሙን ይውድኦም።",
          "5.3 እቲ ብኣካውንታንት ዝተመደበ ንኣሽቱ ወጻምታት ይዳሎ።"
        ]
      }
    ]
  };

  const title = selectedLanguage === 'en' ? 'Church Bylaws' : tigrinyaBylaws.title;
  const subtitle = selectedLanguage === 'en'
    ? 'Abune Aregawi Orthodox Tewahedo Church - Organizational Structure and Guidelines'
    : tigrinyaBylaws.subtitle;

  // TOC is hardcoded in Markdown; no auto-generated TOC needed

  // Assign IDs to headings in rendered content so TOC anchors work
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!contentRef.current) return;
    slugCountsRef.current = {};
    const headings = contentRef.current.querySelectorAll('h1, h2, h3');
    headings.forEach((el) => {
      const text = (el.textContent || '').trim();
      const base = text
        .toLowerCase()
        .replace(/[`~!@#$%^&*()+=|{}\[\]:;"'<>?,./\\]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      const n = (slugCountsRef.current[base] = (slugCountsRef.current[base] || 0) + 1);
      const id = n > 1 ? `${base}-${n - 1}` : base;
      if (id) el.id = id;
    });
  }, [englishMd, tigrinyaMd, selectedLanguage, loadingMd, mdError]);

  return (
    <div
      className="min-h-screen py-12 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL || ''}/bylaws/TigrayOrthodox-background.png)`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top left',
        backgroundSize: 'auto',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
          <p className="text-lg text-gray-600 mb-6">{subtitle}</p>
          {/* Share/Download */}
          <div className="flex justify-center gap-3 mb-4">
            <a
              href={`${process.env.PUBLIC_URL || ''}/${selectedLanguage === 'en' ? 'bylaws/Bylaws-en.md' : 'bylaws/Bylaws-ti.md'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              View Markdown
            </a>
            {selectedLanguage === 'en' && hasPdf && (
              <a
                href={`${process.env.PUBLIC_URL || ''}/bylaws/Bylaws-en.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                Download PDF
              </a>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="text-blue-600 hover:underline text-sm"
            >
              Print
            </button>
          </div>
          
          {/* Language Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-1">
              <button
                onClick={() => setSelectedLanguage('en')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedLanguage === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setSelectedLanguage('ti')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedLanguage === 'ti'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ትግርኛ
              </button>
            </div>
          </div>
          {lastUpdated && (
            <div className="mt-6 text-right">
              <span className="text-xs text-gray-500">Last updated: {lastUpdated}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Auto-generated TOC removed in favor of hardcoded Markdown TOC */}
          <div ref={contentRef} className="prose prose-lg max-w-none">
            {loadingMd ? (
              <p className="text-gray-500">Loading bylaws…</p>
            ) : mdError ? (
              // Fallback to inline content for Tigrinya if fetch fails
              selectedLanguage === 'ti' ? (
                tigrinyaBylaws.sections.map((section, index) => (
                  <section key={index} className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      {section.title}
                    </h2>
                    <div className="space-y-3">
                      {section.items.map((item, itemIndex) => (
                        <p key={itemIndex} className="text-gray-700 leading-relaxed">
                          {item}
                        </p>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className="text-red-600">{mdError}</p>
              )
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  img: ({node, ...props}) => {
                    const src = (props.src || '').toString();
                    const isAbsolute = /^(?:[a-z]+:)?\/\//i.test(src) || src.startsWith('/');
                    const resolved = isAbsolute ? src : `${process.env.PUBLIC_URL || ''}/bylaws/${src}`;
                    const style = {
                      display: 'block',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      maxWidth: '100%'
                    } as React.CSSProperties;
                    // Preserve any existing props.style while enforcing centering
                    const mergedStyle = { ...(props as any).style, ...style };
                    return <img {...props} src={resolved} alt={props.alt || ''} style={mergedStyle} />;
                  },
                }}
              >
                {selectedLanguage === 'en' ? englishMd : tigrinyaMd}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChurchBylaw; 