export interface OcrResult {
  extractedText: string;
  confidence?: number;
  isAvailable: boolean;
  message?: string;
}

export interface IOcrService {
  isServiceAvailable(): Promise<boolean>;
  extractTextFromImage(imageBufferOrBase64: string, mimeType?: string): Promise<OcrResult>;
}
