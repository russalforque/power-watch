import { IOcrService, OcrResult } from './IOcrService.js';
import { GoogleGenAI } from '@google/genai';

/**
 * Modular OCR Service implementation.
 * Can be easily swapped or extended with Tesseract, Google Vision API, Azure OCR, etc.
 * Uses available environment AI key if present, otherwise provides clear non-faked diagnostic.
 */
export class OcrService implements IOcrService {
  private geminiAi: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 5) {
      try {
        this.geminiAi = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('Could not initialize GoogleGenAI for OCR:', err);
      }
    }
  }

  async isServiceAvailable(): Promise<boolean> {
    return Boolean(this.geminiAi);
  }

  async extractTextFromImage(imageBufferOrBase64: string, mimeType = 'image/jpeg'): Promise<OcrResult> {
    if (!this.geminiAi) {
      return {
        extractedText: '',
        isAvailable: false,
        message: 'OCR engine is not configured with an active API key. Please use the primary text paste method.'
      };
    }

    try {
      // Clean base64 header if present
      const cleanBase64 = imageBufferOrBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const response = await this.geminiAi.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Extract the complete, exact raw text from this Visayan Electric power advisory image verbatim. Do not summarize or alter city or barangay names or time slots.'
              },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: cleanBase64
                }
              }
            ]
          }
        ]
      });

      const extracted = response.text || '';
      return {
        extractedText: extracted.trim(),
        confidence: 0.95,
        isAvailable: true
      };
    } catch (error: any) {
      console.error('OCR Extraction error:', error);
      return {
        extractedText: '',
        isAvailable: false,
        message: `OCR processing failed: ${error.message || 'Unknown error'}. Please paste text manually.`
      };
    }
  }
}
