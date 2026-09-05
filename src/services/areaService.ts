import { apiRequest } from './api';
import { Area, BrownoutSchedule, BrownoutPost } from '../types';

export interface AreaWithSchedules {
  area: Area;
  schedules: { schedule: BrownoutSchedule; post: BrownoutPost }[];
}

export const areaService = {
  async getAreas(): Promise<Area[]> {
    return apiRequest<Area[]>('/areas');
  },

  async searchAreas(query: string): Promise<Area[]> {
    return apiRequest<Area[]>(`/areas/search?q=${encodeURIComponent(query)}`);
  },

  async getAreaSchedules(areaId: string): Promise<AreaWithSchedules> {
    return apiRequest<AreaWithSchedules>(`/areas/${areaId}/schedules`);
  },

  async createArea(area: { name: string; city: string; province?: string; latitude: number; longitude: number }): Promise<Area> {
    return apiRequest<Area>('/admin/areas', {
      method: 'POST',
      body: JSON.stringify(area)
    });
  }
};
