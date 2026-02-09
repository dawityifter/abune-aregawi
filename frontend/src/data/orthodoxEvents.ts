export interface CalendarEvent {
    date: string; // ISO format YYYY-MM-DD
    title: string;
    titleTi: string;
    type: 'fast' | 'major_feast' | 'minor_feast' | 'holiday';
    isMajor?: boolean;
    description?: string;
    descriptionTi?: string;
}

export const MONTHLY_COMMEMORATIONS = [
    { day: 1, title: 'Lideta (Birth of Mary) / Elias', titleTi: 'ልደታ (ልደት ማርያም) / ኤልያስ' },
    { day: 2, title: 'Thaddius (Apostle)', titleTi: 'ታዴዎስ ሓዋርያ' },
    { day: 3, title: 'Ba\'eta (Mary) / Ze-neakuto Leab', titleTi: 'ባዕታ ለማርያም / ነኣኩቶ ለአብ' },
    { day: 4, title: 'Yohannis Wolde Negedqwad', titleTi: 'ዮሃንስ ወልደ ነጐድጓድ' },
    { day: 5, title: 'Petros we Paulos / Gebre Menfes Kidus', titleTi: 'ጴጥሮስ ወጳውሎስ / ኣቡነ ገብረ መንፈስ ቅዱስ' },
    { day: 6, title: 'Kusquam (Holy Family) / Arsema', titleTi: 'ቁስቋም / ቅድስት ኣርሴማ' },
    { day: 7, title: 'Holy Trinity (Sillassie)', titleTi: 'ስላሴ' },
    { day: 8, title: 'Cherubim / Abba Kiros', titleTi: 'ኪሩቤል / ኣባ ኪሮስ' },
    { day: 9, title: 'Thomas / 318 Fathers of Nicea', titleTi: 'ቶማስ / 318 ኣበው' },
    { day: 10, title: 'Kidus Meskel (Holy Cross)', titleTi: 'መስቀል' },
    { day: 11, title: 'Hanna we Iyaqem / Fasilides', titleTi: 'ሃና ወኢያቄም / ፋሲለደስ' },
    { day: 12, title: 'Michael the Archangel', titleTi: 'ቅዱስ ሚካኤል' },
    { day: 13, title: 'Igziabher Ab / Raphael the Archangel', titleTi: 'እግዚኣብሄር ኣብ / ቅዱስ ሩፋኤል' },
    { day: 14, title: 'Abune Aregawi / Gebre Kristos', titleTi: 'ኣቡነ ኣረጋዊ / ገብረ ክርስቶስ' },
    { day: 15, title: 'Kirkos we Iyalota', titleTi: 'ቂርቆስ ወኢየሉጣ' },
    { day: 16, title: 'Kidane Meheret (Covenant of Mercy)', titleTi: 'ኪዳነ ምሕረት' },
    { day: 17, title: 'Estifanos (Stephen) / Abba Gerima', titleTi: 'እስጢፋኖስ / ኣባ ገሪማ' },
    { day: 18, title: 'Ewstatewos', titleTi: 'ኤዎስጣጤዎስ' },
    { day: 19, title: 'Gabriel the Archangel', titleTi: 'ቅዱስ ገብርኤል' },
    { day: 20, title: 'Hnstata', titleTi: 'ህንጽታ' },
    { day: 21, title: 'Holy Virgin Mary (Maryam)', titleTi: 'ቅድስት ድንግል ማርያም' },
    { day: 22, title: 'Uriel the Archangel / Deqsius', titleTi: 'ቅዱስ ዑራኤል / ደቅስዮስ' },
    { day: 23, title: 'Georgis (St. George)', titleTi: 'ቅዱስ ጊዮርጊስ' },
    { day: 24, title: 'Abune Tekle Haymanot', titleTi: 'ኣቡነ ተክለ ሃይማኖት' },
    { day: 25, title: 'Merkorios (St. Mercurius)', titleTi: 'ቅዱስ መርቆሬዎስ' },
    { day: 26, title: 'Thomas the Apostle / Joseph', titleTi: 'ቶማስ ሓዋርያ / ዮሴፍ' },
    { day: 27, title: 'Medhane Alem (Savior of the World)', titleTi: 'መድኃኔ ዓለም' },
    { day: 28, title: 'Emmanuel', titleTi: 'ኣማኑኤል' },
    { day: 29, title: 'Beale Wold (Birth of Christ)', titleTi: 'በዓለ ወልድ' },
    { day: 30, title: 'Markos (St. Mark the Evangelist)', titleTi: 'ቅዱስ ማርቆስ' }
];

export const MAJOR_FASTS_LIST = [
    { title: "Fast of the Prophets", titleTi: "ጾመ ነቢያት" },
    { title: "Fast of Nineveh", titleTi: "ጾመ ነነዌ" },
    { title: "Great Lent", titleTi: "ዓቢይ ጾም" },
    { title: "Fast of the Apostles", titleTi: "ጾመ ሓዋርያት" },
    { title: "Fast of Filseta", titleTi: "ጾመ ፍልሰታ" },
    { title: "Wed & Fri Fasting", titleTi: "ጾመ ድሕነት (ረቡዕን ዓርብን)" },
    { title: "Gahad", titleTi: "ጾመ ጋድ" }
];

export const MAJOR_FEASTS_LIST = [
    { title: "Gena (Christmas)", titleTi: "ልደት" },
    { title: "Timket (Epiphany)", titleTi: "ጥምቀት" },
    { title: "Hosanna (Palm Sunday)", titleTi: "ሆሳእና" },
    { title: "Siklet (Good Friday)", titleTi: "ስቅለት" },
    { title: "Fasika (Easter)", titleTi: "ትንሳኤ" },
    { title: "Ascension of the lord (Beale Erget)", titleTi: "ዕርገት" },
    { title: "Pentecost (Paracletos)", titleTi: "ጰራቅሊጦስ" },
    { title: "Beale Transfiguration", titleTi: "ደብረ ታቦር" },
    { title: "Annunciation (His Conception)", titleTi: "በስራት" }
];

export interface EthMonthInfo {
    name: string;
    nameTi: string;
    year: number;
    startGC: string; // ISO
    days: number;
}

// Ethiopian Month metadata for 2025 Gregorian Year
export const ETH_MONTHS_METADATA: EthMonthInfo[] = [
    { name: 'Tir', nameTi: 'ጥሪ', year: 2017, startGC: '2025-01-09', days: 30 },
    { name: 'Yekatit', nameTi: 'ለካቲት', year: 2017, startGC: '2025-02-08', days: 30 },
    { name: 'Megabit', nameTi: 'መጋቢት', year: 2017, startGC: '2025-03-10', days: 30 },
    { name: 'Miazia', nameTi: 'ሚያዝያ', year: 2017, startGC: '2025-04-09', days: 30 },
    { name: 'Ginbot', nameTi: 'ግንቦት', year: 2017, startGC: '2025-05-09', days: 30 },
    { name: 'Sene', nameTi: 'ሰነ', year: 2017, startGC: '2025-06-08', days: 30 },
    { name: 'Hamle', nameTi: 'ሓምለ', year: 2017, startGC: '2025-07-08', days: 30 },
    { name: 'Nehasse', nameTi: 'ነሓሰ', year: 2017, startGC: '2025-08-07', days: 30 },
    { name: 'Pagumes', nameTi: 'ጳጉሜን', year: 2017, startGC: '2025-09-06', days: 5 },
    { name: 'Meskerem', nameTi: 'መስከረም', year: 2018, startGC: '2025-09-11', days: 30 },
    { name: 'Tikemt', nameTi: 'ጥቅምቲ', year: 2018, startGC: '2025-10-11', days: 30 },
    { name: 'Hidar', nameTi: 'ሕዳር', year: 2018, startGC: '2025-11-10', days: 30 },
    { name: 'Tahsas', nameTi: 'ታሕሳስ', year: 2018, startGC: '2025-12-10', days: 30 },
    { name: 'Tir', nameTi: 'ጥሪ', year: 2018, startGC: '2026-01-09', days: 30 }, // For continuity
];

// Helper to get Ethiopian date info for a Gregorian Date
export const getEthiopianDate = (date: Date) => {
    // Normalize input date to local midnight to avoid timezone shifting
    const normalizedInput = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const time = normalizedInput.getTime();

    let currentMonth = ETH_MONTHS_METADATA[0];
    for (let i = 0; i < ETH_MONTHS_METADATA.length; i++) {
        const parts = ETH_MONTHS_METADATA[i].startGC.split('-');
        const anchorDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const start = anchorDate.getTime();

        if (start <= time) {
            currentMonth = ETH_MONTHS_METADATA[i];
        } else {
            break;
        }
    }

    const parts = currentMonth.startGC.split('-');
    const anchorDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const start = anchorDate.getTime();

    // Use Math.round to handle daylight savings transitions cleanly
    const diffDays = Math.round((time - start) / (24 * 60 * 60 * 1000));
    const etDay = diffDays + 1;

    return {
        day: etDay,
        month: currentMonth.name,
        monthTi: currentMonth.nameTi,
        year: currentMonth.year,
        commemoration: MONTHLY_COMMEMORATIONS[(etDay - 1) % 30],
        isPagume: currentMonth.name === 'Pagumes'
    };
};

// Helper to convert number to Ge'ez (Ethiopic) numerals
export const toGeez = (n: number): string => {
    const geezDigits: { [key: number]: string } = {
        1: '፩', 2: '፪', 3: '፫', 4: '፬', 5: '፭', 6: '፮', 7: '፯', 8: '፰', 9: '፱', 10: '፲',
        20: '፳', 30: '፴'
    };
    if (n <= 10) return geezDigits[n];
    if (n < 20) return geezDigits[10] + (geezDigits[n - 10] || '');
    if (n === 20) return geezDigits[20];
    if (n < 30) return geezDigits[20] + (geezDigits[n - 20] || '');
    if (n === 30) return geezDigits[30];
    return n.toString();
};

export const ORTHODOX_EVENTS_2025: CalendarEvent[] = [
    {
        date: '2025-01-06',
        title: 'Gahad of Gena (Christmas Eve)',
        titleTi: 'ጋድ ብርሃነ ልደት',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-01-07',
        title: 'Gena (Ethiopian Christmas)',
        titleTi: 'ብርሃነ ልደት',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-01-18',
        title: 'Gahad of Timket (Epiphany Eve)',
        titleTi: 'ጋድ ብርሃነ ጥምቀት',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-01-19',
        title: 'Timket (Ethiopian Epiphany)',
        titleTi: 'ብርሃነ ጥምቀት',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-01-20',
        title: 'Kana Ze Galilee',
        titleTi: 'ቃና ዘገሊላ',
        type: 'minor_feast',
    },
    {
        date: '2025-01-23',
        title: 'Feast of Abune Aregawi',
        titleTi: 'በዓል ኣቡነ ኣረጋዊ (ጥሪ 14)',
        type: 'major_feast',
    },
    {
        date: '2025-02-10',
        title: 'Fast of Nineveh (Day 1)',
        titleTi: 'ጾመ ነነዌ (1ይ መዓልቲ)',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-02-11',
        title: 'Fast of Nineveh (Day 2)',
        titleTi: 'ጾመ ነነዌ (2ይ መዓልቲ)',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-02-12',
        title: 'Fast of Nineveh (Day 3)',
        titleTi: 'ጾመ ነነዌ (3ይ መዓልቲ)',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-02-17',
        title: 'Start of Abiy Tsom (Great Lent)',
        titleTi: 'ጅማሮ ዓቢይ ጾም',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-04-07',
        title: 'Annunciation',
        titleTi: 'በስራት',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-04-13',
        title: 'Hosanna (Palm Sunday)',
        titleTi: 'ሆሳእና',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-04-18',
        title: 'Siklet (Good Friday)',
        titleTi: 'ስቅለት',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-04-20',
        title: 'Fasika (Ethiopian Easter)',
        titleTi: 'ብርሃነ ትንሳኤ',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-05-29',
        title: 'Ascension of the Lord (Beale Erget)',
        titleTi: 'በዓለ ዕርገት',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-06-08',
        title: 'Paracletos (Pentecost)',
        titleTi: 'ጰራቅሊጦስ',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-06-09',
        title: "Start of Apostles' Fast",
        titleTi: 'ጅማሮ ጾመ ሓዋርያት',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-07-12',
        title: "End of Apostles' Fast (Hamle 5)",
        titleTi: 'ፍጻሜ ጾመ ሓዋርያት',
        type: 'fast',
    },
    {
        date: '2025-08-07',
        title: 'Start of Filseta (Fast of Assumption)',
        titleTi: 'ጅማሮ ጾመ ፍልሰታ',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-08-19',
        title: 'Beale Transfiguration (Debre Tabor)',
        titleTi: 'ደብረ ታቦር',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-08-22',
        title: 'Filseta (Assumption of Mary)',
        titleTi: 'በዓለ ፍልሰታ',
        type: 'major_feast',
        isMajor: true
    },
    {
        date: '2025-09-11',
        title: 'New Year (Enkutatash)',
        titleTi: 'ርእሰ ዓውደ ዓመት (እንቁጣጣሽ)',
        type: 'holiday',
    },
    {
        date: '2025-09-27',
        title: 'Meskel (Finding of the True Cross)',
        titleTi: 'በዓለ መስቀል',
        type: 'major_feast',
    },
    {
        date: '2025-10-25',
        title: 'Feast of Abune Aregawi (Tikemt 14)',
        titleTi: 'በዓል ኣቡነ ኣረጋዊ (ጥቅምቲ 14)',
        type: 'major_feast',
    },
    {
        date: '2025-11-24',
        title: 'Start of Tsom-Nebiyat (Advent Fast)',
        titleTi: 'ጅማሮ ጾመ ነቢያት',
        type: 'fast',
        isMajor: true
    },
    {
        date: '2025-12-28',
        title: 'Kulubi Gabriel',
        titleTi: 'ቁልቢ ገብርኤል',
        type: 'major_feast',
    },
];
