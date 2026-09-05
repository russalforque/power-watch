import { apiRequest } from './api';
import {
  BrownoutPost,
  AdvisoryImportRequest,
  UpdateAdvisoryRequest,
  DuplicateWarning,
  ParsedAdvisoryResult,
  PublicScheduleGroup,
  PostStatus
} from '../types';

export interface ActiveAdvisoryResponse {
  advisory: BrownoutPost;
  schedules: PublicScheduleGroup[];
  lastUpdated: string;
  publishedAt: string | null;
}

export interface ImportAdvisoryResponse {
  advisory: BrownoutPost;
  parsedResult: ParsedAdvisoryResult;
  duplicateWarning: DuplicateWarning;
}

export const advisoryService = {
  // Public
  async getActiveAdvisory(): Promise<ActiveAdvisoryResponse | null> {
    return apiRequest<ActiveAdvisoryResponse>('/advisories/active');
  },

  async getPublishedAdvisories(): Promise<BrownoutPost[]> {
    return apiRequest<BrownoutPost[]>('/advisories');
  },

  async getAdvisoryById(id: string): Promise<BrownoutPost> {
    return apiRequest<BrownoutPost>(`/advisories/${id}`);
  },

  // Admin
  async getAllAdvisories(status?: PostStatus): Promise<BrownoutPost[]> {
    const query = status ? `?status=${status}` : '';
    return apiRequest<BrownoutPost[]>(`/admin/advisories${query}`);
  },

  async importAdvisory(data: AdvisoryImportRequest): Promise<ImportAdvisoryResponse> {
    return apiRequest<ImportAdvisoryResponse>('/admin/advisories/import', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async reparseAdvisory(id: string): Promise<ParsedAdvisoryResult> {
    return apiRequest<ParsedAdvisoryResult>(`/admin/advisories/${id}/parse`, {
      method: 'POST'
    });
  },

  async updateAdvisory(id: string, data: UpdateAdvisoryRequest): Promise<BrownoutPost> {
    return apiRequest<BrownoutPost>(`/admin/advisories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async publishAdvisory(id: string, data?: any): Promise<BrownoutPost> {
    return apiRequest<BrownoutPost>(`/admin/advisories/${id}/publish`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  },

  async archiveAdvisory(id: string): Promise<BrownoutPost> {
    return apiRequest<BrownoutPost>(`/admin/advisories/${id}/archive`, {
      method: 'POST'
    });
  },

  async getDashboardStats(): Promise<any> {
    return apiRequest<any>('/admin/dashboard/stats');
  },

  async getOcrStatus(): Promise<{ isAvailable: boolean; engine: string }> {
    return apiRequest<{ isAvailable: boolean; engine: string }>('/admin/ocr/status');
  }
};
