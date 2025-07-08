import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const ChurchBylaw: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ti'>(currentLanguage);

  const englishBylaws = {
    title: "Church Bylaws",
    subtitle: "Abune Aregawi Orthodox Tewahedo Church - Organizational Structure and Guidelines",
    sections: [
      {
        title: "1. Chairperson",
        items: [
          "1.1 The role of the Chairperson is to lead the Board in accordance with these By-laws.",
          "1.2 The Chairperson shall preside on and conduct all meetings in accordance with these By-laws.",
          "1.3 Shall coordinate the agenda of all meetings and invite members to regular and special meetings.",
          "1.4 Shall obtain approval and mandate from most of the Board members on major negotiations and participation in meetings with different organizations on behalf of the Church.",
          "1.5 May make presentations and/or reports to the General Assembly on behalf of the Board.",
          "1.6 Shall have only one vote like any member of the Board.",
          "1.7 Shall ensure the implementation of all recommendations and action items."
        ]
      },
      {
        title: "2. Vice Chairperson",
        items: [
          "2.1 Shall perform the duties of the Chairperson in his/her absence.",
          "2.2 Has only one vote like all Board members.",
          "2.3 Can be assigned, from time to time, specific tasks and projects as deemed necessary."
        ]
      },
      {
        title: "3. General Secretary",
        items: [
          "3.1 Shall act as a secretary at all Board meetings and General Assemblies.",
          "3.2 Shall be responsible to follow up and report on the progress and status of implementation of major decisions.",
          "3.3 Transmits promptly all relevant communications to parishioners and the board members.",
          "3.4 Prepares meeting agendas and keeps all minutes of the Board and the General Assembly.",
          "3.5 Shall preside over all Board meetings in the absence of the Chairperson and the Vice Chairperson."
        ]
      },
      {
        title: "4. Chief Accountant",
        items: [
          "4.1 Qualification: The Chief accountant should preferably have basic knowledge of accounting and finance. In the absence of such qualified Board member, however, the Board shall solicit volunteer Church member trained in the field to assist the Chief Accountant in his/her activities.",
          "4.2 The Chief Accountant keeps records of all assets and liabilities of the Church in accordance with accepted accounting principles.",
          "4.3 Ensures that an adequate internal control system is exercised within the accounting section of the Church.",
          "4.4 Keeps all financial documents in a safe and orderly manner for reference by authorized personnel of the Church and for examination by auditors.",
          "4.5 Checks, prepares, and ascertains that all payments are paid in a timely manner and within the approved budget.",
          "4.6 Ascertains that all receivable or collections are received, and receipts are issued.",
          "4.7 Prepares semi-annual and annual financial reports for presentation by the Board to the General Assembly.",
          "4.8 Prepares and makes available all relevant financial documents to Auditors.",
          "4.9 Implements Auditors' recommendations regarding the books of accounts.",
          "4.10 Verifies that all payment checks, and finance related agreements are properly signed by designated board signatories.",
          "4.11 Prepares bank reconciliation statements on a monthly basis and submit them to the Board for review and action.",
          "4.12 In consultation with the Chairperson of the Board, prepares annual budget for presentation to the General Assembly.",
          "4.13 Keeps and reconciles Church assets and funds."
        ]
      },
      {
        title: "5. Treasurer",
        items: [
          "5.1 The Treasurer is responsible for keeping and safeguarding Church books and documents.",
          "5.2 Deposits funds and checks in the Church bank account within a week.",
          "5.3 Keeps petty cash as authorized by the accountant."
        ]
      }
    ]
  };

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
          "4.1 ብሕሱምነት: እዚ ሓለዋይ ኣካውንታንት ቀዳምነት ናይ ኣካውንቲን፡ ፋይናንስን ብሕሱም ክህልዎ ኣለዎ። እንተዘይኮነ ግን፡ እቲ ኮሚተ ካብ ኣባላት ቤተ ክርስቲያን ኣብዚ መዳይ ዝሰለጠነ ተጋዳላይ ክሕግዞ ኣለዎ።",
          "4.2 እቲ ሓለዋይ ኣካውንታንት ኵሎም ንብረት ከምኡውን ዕዳታት ቤተ ክርስቲያን ብመሰረት ናይ ተቀባልነት ዘለዎም ኣካውንቲን፡ ሕጋዊ መምርሒታት ይካየድ።",
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

  const bylaws = selectedLanguage === 'en' ? englishBylaws : tigrinyaBylaws;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{bylaws.title}</h1>
          <p className="text-lg text-gray-600 mb-6">
            {bylaws.subtitle}
          </p>
          
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
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="prose prose-lg max-w-none">
            {bylaws.sections.map((section, index) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChurchBylaw; 