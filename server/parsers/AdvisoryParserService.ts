import { IAdvisoryParser, ParseOptions } from './IAdvisoryParser.js';
import { ParsedAdvisoryResult, ParsedScheduleItem, ParsedAreaItem } from '../../src/types/index.js';

export interface AreaLookupProvider {
  findAreaByNameAndCity(name: string, city: string): { id: string; name: string; city: string } | null;
}

export class AdvisoryParserService implements IAdvisoryParser {
  private lookupProvider?: AreaLookupProvider;

  constructor(lookupProvider?: AreaLookupProvider) {
    this.lookupProvider = lookupProvider;
  }

  // Regex patterns
  // Matches times like "10:00 AM - 12:30 PM", "10:00AM–1:30PM", "1:00 PM to 3:30 PM"
  private static TIME_HEADER_REGEX = /^(?:TIME\s*:\s*)?(\d{1,2}(?::\d{2})?\s*(?:AM|PM|NN)?)\s*(?:[-–—~]|TO)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|NN))\b/i;

  // Month names for date parsing
  private static MONTHS: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sept: 9, sep: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12
  };

  // Metro Cebu cities / municipalities under Visayan Electric franchise
  private static KNOWN_CITIES = [
    'Cebu City',
    'Mandaue City',
    'Talisay City',
    'Consolacion',
    'Liloan',
    'Lapu-Lapu City',
    'Minglanilla',
    'City of Naga',
    'Naga City',
    'San Fernando'
  ];

  async parse(text: string, options?: ParseOptions): Promise<ParsedAdvisoryResult> {
    // Normalize Unicode characters (e.g. Facebook bold/italic mathematical alphanumerics to standard ASCII)
    const rawText = (text || '').normalize('NFKD');
    const warnings: string[] = [];
    
    // Clean emojis and decorative symbols while keeping alphanumeric, punctuation, newlines
    const cleanedText = this.stripEmojisAndArtifacts(rawText);
    const lines = cleanedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    // 1. Detect title
    const title = this.extractTitle(lines) || 'ADVISORY: REVISED POSSIBLE ROTATIONAL BROWNOUTS';

    // 2. Detect dates
    const dateRange = this.extractDateRange(lines, options?.referenceYear || 2026);
    if (!dateRange.startDate) {
      warnings.push('Start date could not be automatically detected; defaulting to today.');
    }

    // 3. Detect general advisory time window if present (e.g. 10:00AM-11:00PM overall advisory)
    const generalTimeWindow = this.extractGeneralTime(lines);

    // 4. State-based parsing of schedules and areas
    const schedules: ParsedScheduleItem[] = [];
    let currentSchedule: ParsedScheduleItem | null = null;
    let currentCity = 'Cebu City'; // default fallback city

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip map links, tinyurls, or external links
      if (/^(?:view\s+the\s+map|map\s+link|https?:\/\/|tinyurl\.com)/i.test(line) || /https?:\/\/\S+/i.test(line) && line.length < 60) {
        continue;
      }

      // Check if this line is a time header (e.g., "10:00 AM - 12:30 PM", "⏰1:00PM-2:00PM")
      const timeMatch = this.matchTimeHeader(line);
      if (timeMatch) {
        // Finalize previous schedule ONLY if it actually has areas extracted
        if (currentSchedule && currentSchedule.areas.length > 0) {
          schedules.push(currentSchedule);
        }

        const normalizedStart = this.normalizeTime(timeMatch.start);
        const normalizedEnd = this.normalizeTime(timeMatch.end);

        currentSchedule = {
          id: `sched-${schedules.length + 1}-${Date.now()}`,
          date: dateRange.startDate || new Date().toISOString().slice(0, 10),
          startTime: normalizedStart,
          endTime: normalizedEnd,
          scheduleType: 'PossibleRotationalBrownout',
          areas: []
        };
        continue;
      }

      // If we are not inside a time window yet, skip non-schedule header lines
      if (!currentSchedule) {
        continue;
      }

      // Check if line specifies a City (e.g. "Portion of Liloan: ...", "Cebu City: Calamba, Capitol Site")
      const cityDetection = this.detectCityInLine(line);
      let areaText = line;
      if (cityDetection.detected) {
        currentCity = cityDetection.cityName;
        areaText = cityDetection.remainingText;
      }

      if (!areaText || areaText.trim().length === 0) {
        continue;
      }

      // Extract barangay/area names from areaText
      const extractedAreas = this.extractAreasFromText(areaText, currentCity);

      // Add to current schedule, preventing duplicate names inside the same schedule
      for (const area of extractedAreas) {
        const existing = currentSchedule.areas.find(
          a => a.normalizedName === area.normalizedName && a.city.toLowerCase() === area.city.toLowerCase()
        );
        if (!existing) {
          currentSchedule.areas.push(area);
        }
      }
    }

    // Push the last schedule if exists
    if (currentSchedule && currentSchedule.areas.length > 0) {
      schedules.push(currentSchedule);
    } else if (currentSchedule && schedules.length === 0) {
      schedules.push(currentSchedule);
    }

    if (schedules.length === 0) {
      warnings.push('No schedule time windows were detected. Please ensure time headers follow "HH:MM AM - HH:MM PM" format.');
    }

    // Tally unmatched vs matched
    let unrecognizedAreasCount = 0;
    let totalAreasCount = 0;

    for (const sched of schedules) {
      for (const a of sched.areas) {
        totalAreasCount++;
        if (!a.isMatched) {
          unrecognizedAreasCount++;
        }
      }
    }

    return {
      title,
      source: options?.defaultSource || 'Visayan Electric',
      sourceUrl: options?.sourceUrl || '',
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      generalTimeWindow,
      schedules,
      originalText: rawText,
      unrecognizedAreasCount,
      totalAreasCount,
      warnings
    };
  }

  /**
   * Cleans emojis, fancy unicode bullet points, and decorative symbols.
   */
  private stripEmojisAndArtifacts(text: string): string {
    return text
      // Replace non-standard dashes and bullets
      .replace(/[•●▪■◆★☆*]/g, ' ')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Remove all emojis and pictographs across all Unicode planes
      .replace(/[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, ' ')
      .replace(/[ \t]+/g, ' ');
  }

  /**
   * Detects advisory title from header lines.
   */
  private extractTitle(lines: string[]): string | null {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      if (/ADVISORY/i.test(line) || /ROTATIONAL\s+BROWNOUT/i.test(line) || /POSSIBLE\s+BROWNOUT/i.test(line) || /REVISED\s+SCHEDULE/i.test(line)) {
        return line.replace(/^[-–—:#\s]+/, '').trim();
      }
    }
    return null;
  }

  /**
   * Detects date range e.g. "SEPTEMBER 3-6, 2026", "SEPTEMBER 5, 2026", "DAILY | SEPTEMBER 3-6, 2026"
   */
  private extractDateRange(lines: string[], defaultYear: number): { startDate: string; endDate: string } {
    const todayStr = new Date().toISOString().slice(0, 10);
    
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];

      // Pattern: SEPTEMBER 3-6, 2026 or SEPT. 3-6, 2026 or SEPTEMBER 3 TO 6, 2026
      const rangeMatch = line.match(/\b([A-Za-z]+)\.?\s+(\d{1,2})\s*[-–—to\s]+\s*(\d{1,2})(?:[,\s]+(\d{4}))?\b/i);
      if (rangeMatch) {
        const monthName = rangeMatch[1].toLowerCase();
        const monthNum = AdvisoryParserService.MONTHS[monthName];
        if (monthNum) {
          const startDay = parseInt(rangeMatch[2], 10);
          const endDay = parseInt(rangeMatch[3], 10);
          const year = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : defaultYear;

          const startStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
          const endStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
          return { startDate: startStr, endDate: endStr };
        }
      }

      // Pattern: Single date e.g. "SEPTEMBER 5, 2026" or "SEPT 5 2026"
      const singleMatch = line.match(/\b([A-Za-z]+)\.?\s+(\d{1,2})(?:[,\s]+(\d{4}))?\b/i);
      if (singleMatch) {
        const monthName = singleMatch[1].toLowerCase();
        const monthNum = AdvisoryParserService.MONTHS[monthName];
        if (monthNum) {
          const day = parseInt(singleMatch[2], 10);
          const year = singleMatch[3] ? parseInt(singleMatch[3], 10) : defaultYear;
          const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return { startDate: dateStr, endDate: dateStr };
        }
      }
    }

    return { startDate: todayStr, endDate: todayStr };
  }

  /**
   * Checks if an entire line is an overall advisory time (e.g. "10:00AM–11:00PM" near the top before schedule blocks)
   */
  private extractGeneralTime(lines: string[]): string | undefined {
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const line = lines[i];
      if (/OVERALL|DAILY\s*\|\s*10|HOURS/i.test(line)) {
        const match = this.matchTimeHeader(line);
        if (match) {
          return `${match.start} - ${match.end}`;
        }
      }
    }
    return undefined;
  }

  /**
   * Matches a time header like "10:00 AM–12:30 PM", "10:00AM - 12:30PM", "1:00PM-2:00PM"
   */
  private matchTimeHeader(line: string): { start: string; end: string } | null {
    const trimmed = line.trim();
    // Exclude if line contains "daily |" or says "hours rotational brownout"
    if (trimmed.toLowerCase().startsWith('daily |') || /hours\s+rotational\s+brownout/i.test(trimmed)) {
      return null;
    }

    const match = trimmed.match(/(?:(?:TIME|SCHEDULE)\s*:\s*)?(\d{1,2}(?::\d{2})?\s*(?:AM|PM|NN)?)\s*(?:[-–—~]|TO)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|NN))\b/i);
    if (match) {
      return {
        start: match[1].trim(),
        end: match[2].trim()
      };
    }
    return null;
  }

  /**
   * Detects if a line starts with or contains a known city header (e.g., "Portion of Liloan: ...", "Cebu City: ...")
   */
  private detectCityInLine(line: string): { detected: boolean; cityName: string; remainingText: string } {
    const cleanLine = line.replace(/^[^\w\s]+/, '').trim();

    for (const city of AdvisoryParserService.KNOWN_CITIES) {
      // Matches "Portion of Liloan:", "Portions of Cebu City:", "Liloan:", "Consolacion -"
      const regex = new RegExp(`^(?:(?:portions?|parts?)\\s+of\\s+)?${city}\\s*[:\\-]\\s*(.*)$`, 'i');
      const match = cleanLine.match(regex);
      if (match) {
        return {
          detected: true,
          cityName: this.canonicalizeCity(city),
          remainingText: match[1] || ''
        };
      }

      // Check if line is JUST the city name (e.g. "Cebu City" alone or "Portion of Liloan")
      const soloRegex = new RegExp(`^(?:(?:portions?|parts?)\\s+of\\s+)?${city}\\s*$`, 'i');
      if (soloRegex.test(cleanLine)) {
        return {
          detected: true,
          cityName: this.canonicalizeCity(city),
          remainingText: ''
        };
      }
    }

    return { detected: false, cityName: '', remainingText: line };
  }

  private canonicalizeCity(city: string): string {
    const lower = city.toLowerCase();
    if (lower.includes('cebu')) return 'Cebu City';
    if (lower.includes('mandaue')) return 'Mandaue City';
    if (lower.includes('talisay')) return 'Talisay City';
    if (lower.includes('consolacion')) return 'Consolacion';
    if (lower.includes('liloan')) return 'Liloan';
    if (lower.includes('lapu')) return 'Lapu-Lapu City';
    if (lower.includes('minglanilla')) return 'Minglanilla';
    if (lower.includes('naga')) return 'City of Naga';
    if (lower.includes('fernando')) return 'San Fernando';
    return city;
  }

  /**
   * Splits barangay list by comma, semicolons, or " & " / " and ", and normalizes them.
   */
  private extractAreasFromText(text: string, city: string): ParsedAreaItem[] {
    // Replace " & " and " and " with commas so joined areas are split cleanly
    const preparedText = text
      .replace(/\s+(&|and)\s+/gi, ', ')
      .replace(/https?:\/\/\S+/gi, '');

    const rawTokens = preparedText.split(/[,;\n]+/).map(t => t.trim()).filter(t => t.length > 0);
    const results: ParsedAreaItem[] = [];

    for (const token of rawTokens) {
      // Skip explanatory prefixes like "Portions of", "Parts of", "Brgy.", leading/trailing "&"
      let clean = token
        .replace(/^(?:portions?\s+of|parts?\s+of|including|along|brgy\.?|barangay|and|&)\s+/i, '')
        .replace(/\s+(&|and)$/i, '')
        .replace(/\.+$/, '')
        .trim();

      // Skip non-area sentences, warnings, disclaimers, urls, or noise
      if (
        clean.length < 2 ||
        clean.length > 60 ||
        /^(view|due to|note|please|visayan|electric|schedule|advisory|attention|source|random|thank|unplug|appliances|apologize|we regret|stay tuned|portions|map)/i.test(clean) ||
        /\b(appliances|inconvenience|brownouts?|outages?|customers?|situation|deficiency|megawatts?|tinyurl|https?)\b/i.test(clean)
      ) {
        continue;
      }

      const normalized = this.normalizeAreaName(clean);
      let isMatched = false;
      let matchedAreaId: string | null = null;
      let matchedArea: any = null;

      if (this.lookupProvider) {
        // Try exact name match first
        let found = this.lookupProvider.findAreaByNameAndCity(clean, city);
        
        // If not found and has parenthetical alias e.g. "Duljo (Duljo Fatima)" or "San Nicolas (San Nicolas Proper)"
        if (!found && clean.includes('(')) {
          const alias = clean.replace(/.*\((.*?)\).*/, '$1').trim();
          const base = clean.replace(/\(.*?\)/, '').trim();
          found = this.lookupProvider.findAreaByNameAndCity(alias, city) || this.lookupProvider.findAreaByNameAndCity(base, city);
        }

        if (found) {
          isMatched = true;
          matchedAreaId = found.id;
          matchedArea = found;
        }
      }

      results.push({
        rawName: clean,
        normalizedName: normalized,
        city,
        isMatched,
        matchedAreaId,
        matchedArea
      });
    }

    return results;
  }

  private normalizeAreaName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes time format to "10:00 AM" or "12:30 PM"
   */
  private normalizeTime(timeStr: string): string {
    let t = timeStr.trim().toUpperCase();
    // If no colon e.g. "10AM" -> "10:00 AM"
    const match = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|NN)?$/i);
    if (!match) return timeStr;

    const hour = parseInt(match[1], 10);
    const minute = match[2] ? match[2] : '00';
    let ampm = match[3] || '';

    if (ampm === 'NN') {
      ampm = 'PM';
    }

    if (!ampm) {
      // Guess am/pm based on hour
      ampm = hour >= 8 && hour <= 11 ? 'AM' : 'PM';
    }

    return `${hour}:${minute} ${ampm}`;
  }
}
