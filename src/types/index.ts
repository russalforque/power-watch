export type PostStatus = 'Draft' | 'Published' | 'Archived';
export type ScheduleType = 'PossibleRotationalBrownout';

export interface Area {
  id: string;
  name: string;
  normalizedName: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  geoJson?: any | null;
  isActive: boolean;
}

export interface BrownoutPost {
  id: string;
  title: string;
  originalContent: string;
  source: string;
  sourceUrl?: string;
  originalImagePath?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  schedules?: BrownoutScheduleWithAreas[];
}

export interface BrownoutSchedule {
  id: string;
  brownoutPostId: string;
  scheduleDate: string; // YYYY-MM-DD
  startTime: string;    // e.g. "10:00 AM"
  endTime: string;      // e.g. "12:30 PM"
  scheduleType: ScheduleType;
  status: 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled';
  createdAt: string;
}

export interface BrownoutScheduleArea {
  id: string;
  brownoutScheduleId: string;
  areaId: string;
  rawAreaName: string;
  isMatched: boolean;
  matchedAreaId?: string | null;
  cityHint?: string;
}

export interface ParsedAreaItem {
  rawName: string;
  normalizedName: string;
  city: string;
  isMatched: boolean;
  matchedAreaId?: string | null;
  matchedArea?: Area | null;
}

export interface ParsedScheduleItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  scheduleType: ScheduleType;
  areas: ParsedAreaItem[];
}

export interface ParsedAdvisoryResult {
  title: string;
  source: string;
  sourceUrl?: string;
  startDate: string;
  endDate: string;
  generalTimeWindow?: string;
  schedules: ParsedScheduleItem[];
  originalText: string;
  unrecognizedAreasCount: number;
  totalAreasCount: number;
  warnings: string[];
}

export interface BrownoutScheduleWithAreas extends BrownoutSchedule {
  areas: (Area & { rawAreaName?: string; isMatched?: boolean })[];
}

export interface AdvisoryImportRequest {
  text: string;
  sourceUrl?: string;
  imageDataUrl?: string;
  imageFileName?: string;
  source?: string;
  title?: string;
}

export interface UpdateAdvisoryRequest {
  title: string;
  source: string;
  sourceUrl?: string;
  startDate: string;
  endDate: string;
  status?: PostStatus;
  schedules: {
    id?: string;
    scheduleDate: string;
    startTime: string;
    endTime: string;
    scheduleType: ScheduleType;
    areas: {
      rawAreaName: string;
      city: string;
      matchedAreaId?: string | null;
    }[];
  }[];
}

export interface DuplicateWarning {
  isDuplicate: boolean;
  message?: string;
  existingPostId?: string;
  existingPostTitle?: string;
  existingAdvisory?: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    status: PostStatus;
  };
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'Admin';
}

export interface AuthResponse {
  token: string;
  user: AdminUser;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

export interface PublicScheduleGroup {
  id: string;
  scheduleDate: string;
  timeWindow: string;
  startTime: string;
  endTime: string;
  scheduleType: ScheduleType;
  advisoryTitle: string;
  source: string;
  sourceUrl?: string;
  updatedAt: string;
  totalAreas?: number;
  areasByCity: {
    city: string;
    areas: Area[];
  }[];
}
