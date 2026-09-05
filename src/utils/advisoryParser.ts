// src/utils/advisoryParser.ts

export interface ParsedBarangay {
  id: string;
  name: string;
  needsReview: boolean;
  reviewReason?: string;
}

export interface ParsedCityGroup {
  id: string;
  city: string;
  rawText: string;
  barangays: ParsedBarangay[];
  needsReview: boolean;
}

export interface ParsedScheduleSlot {
  id: string;
  scheduleNumber: number;
  timeWindow: string;
  duration?: string;
  mapUrl?: string;
  cityGroups: ParsedCityGroup[];
}

export interface ParsedAdvisoryResult {
  title: string;
  advisoryType: 'Rotational Brownout' | 'Emergency Interruption' | 'Scheduled Maintenance' | 'Grid Advisory';
  dateRange: string;
  duration: string;
  sourceAuthority: string;
  schedules: ParsedScheduleSlot[];
  mapUrls: string[];
  totalSchedules: number;
  totalLocations: number;
  uncertainCount: number;
  rawText: string;
  parsedAt: string;
}

const VECO_CITIES_AND_BARANGAYS: Record<string, string[]> = {
  'Cebu City': [
    'Agsungot', 'Apas', 'Babag', 'Bacayan', 'Banilad', 'Basak Pardo', 'Basak San Nicolas',
    'Bonbon', 'Budlaan', 'Buhisan', 'Bulacao', 'Buot', 'Busay', 'Calamba', 'Cambinocot',
    'Camputhaw', 'Kamputhaw', 'Capitol Site', 'Carreta', 'Cogon Pardo', 'Cogon Ramos',
    'Day-as', 'Duljo Fatima', 'Ermita', 'Guba', 'Guadalupe', 'Hipodromo', 'Inayawan',
    'Kalubihan', 'Kalunasan', 'Kasambagan', 'Kinasang-an', 'Labangon', 'Lahug', 'Lorega',
    'Lusaran', 'Luz', 'Mabini', 'Mabolo', 'Malubog', 'Mambaling', 'Pahina Central',
    'Pahina San Nicolas', 'Pamutan', 'Pardo', 'Pari-an', 'Parian', 'Paril', 'Pasil',
    'Pit-os', 'Poblacion Pardo', 'Pulangbato', 'Punta Princesa', 'Quiot', 'Sambag I',
    'Sambag II', 'San Antonio', 'San Jose', 'San Nicolas Proper', 'San Roque', 'Santa Cruz',
    'Santo Niño', 'Sawang Calero', 'Sinsin', 'Sirao', 'Suba', 'Sudlon I', 'Sudlon II',
    'T. Padilla', 'Tabunan', 'Tagbao', 'Talamban', 'Taptap', 'Tejero', 'Tinago', 'Tisa',
    'Toong', 'Zapatera'
  ],
  'Mandaue City': [
    'Alang-alang', 'Bakilid', 'Banilad', 'Basak', 'Cabancalan', 'Cambaro', 'Canduman',
    'Casili', 'Casuntingan', 'Centro', 'Cubacub', 'Guizo', 'Ibabao-Estancia', 'Jagobiao',
    'Labogon', 'Looc', 'Maguikay', 'Mantuyong', 'Opao', 'Paknaan', 'Pagsabungan',
    'Subangdaku', 'Tabok', 'Tawason', 'Tingub', 'Tipolo', 'Umapad'
  ],
  'Talisay City': [
    'Biasong', 'Bulacao', 'Camp IV', 'Cansojong', 'Dumlog', 'Jaclupan', 'Lagtang',
    'Lawaan I', 'Lawaan II', 'Lawaan III', 'Linao', 'Maghaway', 'Manipis', 'Mohon',
    'Poblacion', 'Pooc', 'San Isidro', 'San Roque', 'Tabunok', 'Tangke', 'Tapul'
  ],
  'City of Naga': [
    'Alpaco', 'Bawa', 'Cabungahan', 'Cantao-an', 'Central Poblacion', 'Cogon', 'Colon',
    'East Poblacion', 'Inayagan', 'Inoburan', 'Jaguimit', 'Lanas', 'Langtad', 'Lutac',
    'Mainit', 'Mayana', 'Naalad', 'North Poblacion', 'Pangdan', 'Patag', 'South Poblacion',
    'Tagjaguimit', 'Tangke', 'Tinaan', 'Tuyan', 'Uling', 'West Poblacion'
  ],
  'Consolacion': [
    'Cabangahan', 'Cansaga', 'Casili', 'Danlag', 'Garing', 'Jugan', 'Lamac', 'Nangka',
    'Panas', 'Panoypoy', 'Pitogo', 'Poblacion', 'Polog', 'Pulpogan', 'Sacsac', 'Tayud',
    'Tugbongan'
  ],
  'Liloan': [
    'Cabadiangan', 'Calero', 'Catarman', 'Cotcot', 'Jubay', 'Lataban', 'Mulao',
    'Poblacion', 'San Roque', 'San Vicente', 'Santa Cruz', 'Tabla', 'Tayud', 'Yati'
  ],
  'Minglanilla': [
    'Cadulawan', 'Calajoan', 'Camp 7', 'Camp 8', 'Cuanos', 'Guindaruhan', 'Linao',
    'Manduang', 'Pakigne', 'Poblacion Ward 1', 'Poblacion Ward 2', 'Tubod', 'Tulay',
    'Tungkop', 'Tungkil', 'Vito'
  ],
  'San Fernando': [
    'Balungag', 'Buanoy', 'Cabatbatan', 'Greenhills', 'Ilaya', 'Lantawan', 'Magsico',
    'Panadtaran', 'Pitalo', 'Poblacion North', 'Poblacion South', 'San Isidro',
    'Sangat', 'Tabionan', 'Tananas', 'Tinubdan', 'Tonggo', 'Tubod'
  ]
};

export function normalizeFacebookText(input: string): string {
  if (!input) return '';
  let text = input.normalize('NFKD');
  let clean = '';
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (!cp) continue;
    if ((cp >= 0x1d400 && cp <= 0x1d419) || (cp >= 0x1d5d4 && cp <= 0x1d5ed)) {
      clean += String.fromCharCode(65 + ((cp - (cp >= 0x1d5d4 ? 0x1d5d4 : 0x1d400)) % 26));
    } else if ((cp >= 0x1d41a && cp <= 0x1d433) || (cp >= 0x1d5ee && cp <= 0x1d607)) {
      clean += String.fromCharCode(97 + ((cp - (cp >= 0x1d5ee ? 0x1d5ee : 0x1d41a)) % 26));
    } else if ((cp >= 0x1d7ce && cp <= 0x1d7d7) || (cp >= 0x1d7ec && cp <= 0x1d7f5)) {
      clean += String.fromCharCode(48 + ((cp - (cp >= 0x1d7ec ? 0x1d7ec : 0x1d7ce)) % 10));
    } else if (cp >= 0xff01 && cp <= 0xff5e) {
      clean += String.fromCharCode(cp - 0xfee0);
    } else {
      clean += char;
    }
  }
  return clean
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[•●■◆►▸▪▫]/g, '•');
}

function matchTimeWindow(line: string): { isMatch: boolean; timeText: string } {
  const trimmed = line.trim();
  const timeRegex = /(?:(?:Schedule|Batch|Slot|Window)\s*\d+[:\-—\s]*)?\(?(\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\s*(?:-|to|until)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\)?/i;
  const match = trimmed.match(timeRegex);
  if (match) {
    return { isMatch: true, timeText: match[1].trim() };
  }
  return { isMatch: false, timeText: '' };
}

function detectCity(text: string): { city: string; remainder: string } | null {
  const normalized = text.replace(/^[•\-\*\s]+/, '').trim();
  for (const knownCity of Object.keys(VECO_CITIES_AND_BARANGAYS)) {
    const patterns = [
      new RegExp(`^(?:Portion|Portions|Parts?)\\s+of\\s+${knownCity}[:\\-\\s]+(.*)$`, 'i'),
      new RegExp(`^${knownCity}[:\\-\\s]+(.*)$`, 'i'),
      new RegExp(`^Municipality\\s+of\\s+${knownCity}[:\\-\\s]+(.*)$`, 'i')
    ];
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        return { city: knownCity, remainder: match[1].trim() };
      }
    }
  }
  const colonIndex = normalized.indexOf(':');
  if (colonIndex > 0 && colonIndex < 35) {
    const candidateCity = normalized.substring(0, colonIndex).replace(/^(?:Portions?|Parts?)\s+of\s+/i, '').trim();
    const matchedKnown = Object.keys(VECO_CITIES_AND_BARANGAYS).find(
      c => c.toLowerCase() === candidateCity.toLowerCase()
    );
    if (matchedKnown) {
      return { city: matchedKnown, remainder: normalized.substring(colonIndex + 1).trim() };
    }
    return { city: candidateCity, remainder: normalized.substring(colonIndex + 1).trim() };
  }
  return null;
}

function splitBarangays(text: string): string[] {
  return text
    .replace(/\s+and\s+/gi, ', ')
    .replace(/\s*&\s*/g, ', ')
    .split(/[,;\/]/)
    .map(b => b.replace(/^[•\-\*\s]+/, '').replace(/^Brgy\.?\s+/i, '').replace(/^Barangay\s+/i, '').trim())
    .filter(b => b.length > 1 && !/^(etc\.?|none|and|portion)$/i.test(b));
}

export function parseFacebookAdvisory(rawInput: string): ParsedAdvisoryResult {
  const normalized = normalizeFacebookText(rawInput);
  const lines = normalized.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let title = 'Visayan Electric Rotational Brownout Advisory';
  let advisoryType: ParsedAdvisoryResult['advisoryType'] = 'Rotational Brownout';
  let dateRange = '';
  let overallDuration = '';
  const mapUrls: string[] = [];

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urlsInText = normalized.match(urlRegex) || [];
  urlsInText.forEach(u => {
    const cleanUrl = u.replace(/[),.;]+$/, '');
    if (!mapUrls.includes(cleanUrl)) mapUrls.push(cleanUrl);
  });

  const dateRegex = /(?:DAILY\s*\|\s*)?((?:JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\.?\s+\d{1,2}(?:\s*(?:-|–|TO)\s*\d{1,2})?(?:,?\s*\d{4})?)/i;
  const dateMatch = normalized.match(dateRegex);
  if (dateMatch) {
    dateRange = dateMatch[1].trim();
  }

  const durationRegex = /(\b\d+(?:\.\d+)?\s*(?:hour|hours|hr|hrs)(?:\s*per\s*area)?)/i;
  const durationMatch = normalized.match(durationRegex);
  if (durationMatch) {
    overallDuration = durationMatch[1].trim();
  }

  const titleLine = lines.find(l => /ADVISORY|BROWNOUT|ROTATIONAL|EMERGENCY|INTERRUPTION/i.test(l));
  if (titleLine) {
    title = titleLine.replace(/^[•\-\*\s]+/, '').replace(/^ADVISORY:\s*/i, 'ADVISORY: ');
  }
  if (/REVISED/i.test(normalized)) {
    advisoryType = 'Rotational Brownout';
    if (!title.toLowerCase().includes('revised')) {
      title = `REVISED: ${title}`;
    }
  }

  const schedules: ParsedScheduleSlot[] = [];
  let currentSchedule: ParsedScheduleSlot | null = null;
  let scheduleCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timeMatch = matchTimeWindow(line);
    if (timeMatch.isMatch) {
      scheduleCount++;
      currentSchedule = {
        id: `sched-${scheduleCount}-${Date.now()}`,
        scheduleNumber: scheduleCount,
        timeWindow: timeMatch.timeText,
        duration: overallDuration || '1 hour',
        cityGroups: []
      };

      const urlInLine = line.match(urlRegex);
      if (urlInLine) {
        currentSchedule.mapUrl = urlInLine[0].replace(/[),.;]+$/, '');
      }

      schedules.push(currentSchedule);
      continue;
    }

    if (!currentSchedule) continue;

    if (/map[:\s]|waze|goo\.gl|bit\.ly/i.test(line)) {
      const lineMap = line.match(urlRegex);
      if (lineMap && !currentSchedule.mapUrl) {
        currentSchedule.mapUrl = lineMap[0].replace(/[),.;]+$/, '');
      }
      continue;
    }

    const cityMatch = detectCity(line);
    if (cityMatch) {
      const knownBarangaysInCity = VECO_CITIES_AND_BARANGAYS[cityMatch.city] || [];
      const isKnownCity = Object.keys(VECO_CITIES_AND_BARANGAYS).includes(cityMatch.city);
      const rawBarangays = splitBarangays(cityMatch.remainder);

      const barangayObjects: ParsedBarangay[] = rawBarangays.map((bName, idx) => {
        const isMatched = knownBarangaysInCity.some(
          kb => kb.toLowerCase() === bName.toLowerCase()
        );

        return {
          id: `bgy-${scheduleCount}-${idx}-${Date.now()}`,
          name: bName,
          needsReview: !isMatched,
          reviewReason: !isMatched ? 'Unrecognized barangay or street name' : undefined
        };
      });

      currentSchedule.cityGroups.push({
        id: `city-${scheduleCount}-${currentSchedule.cityGroups.length}-${Date.now()}`,
        city: cityMatch.city,
        rawText: line,
        barangays: barangayObjects,
        needsReview: !isKnownCity || barangayObjects.some(b => b.needsReview)
      });
    }
  }

  if (schedules.length === 0) {
    const fallbackCities: ParsedCityGroup[] = [];
    lines.forEach((line, idx) => {
      const cityMatch = detectCity(line);
      if (cityMatch) {
        const rawBarangays = splitBarangays(cityMatch.remainder);
        fallbackCities.push({
          id: `fallback-city-${idx}`,
          city: cityMatch.city,
          rawText: line,
          barangays: rawBarangays.map((b, bIdx) => ({
            id: `fallback-bgy-${idx}-${bIdx}`,
            name: b,
            needsReview: false
          })),
          needsReview: false
        });
      }
    });

    schedules.push({
      id: `sched-fallback-${Date.now()}`,
      scheduleNumber: 1,
      timeWindow: 'Advisory Duration Window',
      duration: overallDuration || 'As Stated',
      cityGroups: fallbackCities,
      mapUrl: mapUrls[0]
    });
  }

  let totalLocations = 0;
  let uncertainCount = 0;

  schedules.forEach(sched => {
    sched.cityGroups.forEach(cg => {
      totalLocations += cg.barangays.length;
      cg.barangays.forEach(b => {
        if (b.needsReview) uncertainCount++;
      });
      if (cg.needsReview && cg.barangays.length === 0) {
        uncertainCount++;
      }
    });
  });

  return {
    title,
    advisoryType,
    dateRange: dateRange || 'Dates as posted',
    duration: overallDuration || 'Stated intervals',
    sourceAuthority: 'Visayan Electric',
    schedules,
    mapUrls,
    totalSchedules: schedules.length,
    totalLocations,
    uncertainCount,
    rawText: rawInput,
    parsedAt: new Date().toISOString()
  };
}