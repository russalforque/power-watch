import { ParsedAdvisoryResult } from '../../src/types/index.js';

export interface ParseOptions {
  sourceUrl?: string;
  defaultSource?: string;
  referenceYear?: number;
}

export interface IAdvisoryParser {
  parse(text: string, options?: ParseOptions): Promise<ParsedAdvisoryResult>;
}
