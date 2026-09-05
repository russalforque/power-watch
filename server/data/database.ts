import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Area, BrownoutPost, BrownoutSchedule, BrownoutScheduleArea, AdminUser, PostStatus } from '../../src/types/index.js';
import { SEED_AREAS } from './seedAreas.js';

export interface DbUser extends AdminUser {
  passwordHash: string;
}

export interface DbSchema {
  areas: Area[];
  posts: BrownoutPost[];
  schedules: BrownoutSchedule[];
  scheduleAreas: BrownoutScheduleArea[];
  users: DbUser[];
}

const DB_FILE = path.join(process.cwd(), 'server', 'data', 'powerwatch_db.json');

export class Database {
  private static instance: Database;
  private data: DbSchema = {
    areas: [],
    posts: [],
    schedules: [],
    scheduleAreas: [],
    users: []
  };

  private constructor() {
    this.load();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private load(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.seedInitial();
      }
    } catch (e) {
      console.warn('Error reading database file, seeding afresh:', e);
      this.seedInitial();
    }

    // Ensure all seed areas are present if empty
    if (!this.data.areas || this.data.areas.length === 0) {
      this.data.areas = [...SEED_AREAS];
      this.save();
    }

    // Ensure admin user is seeded
    if (!this.data.users || this.data.users.length === 0) {
      this.seedAdminUser();
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist database to file:', e);
    }
  }

  private seedAdminUser(): void {
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPowerWatch2026!';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPassword, salt);

    const admin: DbUser = {
      id: 'admin-1',
      username: 'admin',
      email: 'admin@powerwatch.cebu',
      role: 'Admin',
      passwordHash: hash
    };

    this.data.users = [admin];
    this.save();
  }

  private seedInitial(): void {
    this.data.areas = [...SEED_AREAS];
    this.seedAdminUser();

    // Create an initial sample published advisory based on a realistic Visayan Electric advisory
    // so guests opening the MVP immediately see active data, interactive map highlights, and schedules
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 3);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const samplePostId = 'post-veco-sample-1';
    const samplePost: BrownoutPost = {
      id: samplePostId,
      title: 'ADVISORY: REVISED POSSIBLE ROTATIONAL BROWNOUTS',
      originalContent: `ADVISORY: REVISED POSSIBLE ROTATIONAL BROWNOUTS
DAILY | ${todayStr} to ${endDateStr}
10:00AM-11:00PM

Due to grid power supply generation deficiency, Visayan Electric announces the following POSSIBLE ROTATIONAL BROWNOUTS schedule:

10:00 AM–12:30 PM
Cebu City: Calamba, Capitol Site, Guadalupe, Labangon, Sambag 1, Sambag 2
Mandaue City: Basak, Centro, Jagobiao, Labogon, Paknaan, Tabok

01:00 PM–03:30 PM
Cebu City: Apas, Lahug, Mabolo, Kasambagan, Banilad
Talisay City: Cansojong, Lawaan I, Linao, Mohon, San Isidro, Tabunok

04:00 PM–06:30 PM
Cebu City: Camputhaw, Tisa, Punta Princesa, Mambaling, Basak San Nicolas
Consolacion: Casili, Danlag, Jugan, Pitogo, Poblacion`,
      source: 'Visayan Electric',
      sourceUrl: 'https://www.facebook.com/visayanelectric',
      startDate: todayStr,
      endDate: endDateStr,
      status: 'Published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString()
    };

    // Schedule 1: 10:00 AM - 12:30 PM
    const sched1Id = 'sched-sample-1';
    const sched1: BrownoutSchedule = {
      id: sched1Id,
      brownoutPostId: samplePostId,
      scheduleDate: todayStr,
      startTime: '10:00 AM',
      endTime: '12:30 PM',
      scheduleType: 'PossibleRotationalBrownout',
      status: 'Scheduled',
      createdAt: new Date().toISOString()
    };

    // Schedule 2: 1:00 PM - 3:30 PM
    const sched2Id = 'sched-sample-2';
    const sched2: BrownoutSchedule = {
      id: sched2Id,
      brownoutPostId: samplePostId,
      scheduleDate: todayStr,
      startTime: '01:00 PM',
      endTime: '03:30 PM',
      scheduleType: 'PossibleRotationalBrownout',
      status: 'Scheduled',
      createdAt: new Date().toISOString()
    };

    // Schedule 3: 4:00 PM - 6:30 PM
    const sched3Id = 'sched-sample-3';
    const sched3: BrownoutSchedule = {
      id: sched3Id,
      brownoutPostId: samplePostId,
      scheduleDate: todayStr,
      startTime: '04:00 PM',
      endTime: '06:30 PM',
      scheduleType: 'PossibleRotationalBrownout',
      status: 'Scheduled',
      createdAt: new Date().toISOString()
    };

    this.data.posts = [samplePost];
    this.data.schedules = [sched1, sched2, sched3];

    // Link schedule areas
    const scheduleAreas: BrownoutScheduleArea[] = [];

    // Helper to link
    const linkAreas = (schedId: string, areaNames: { name: string; city: string }[]) => {
      for (const item of areaNames) {
        const found = this.data.areas.find(
          a => a.name.toLowerCase() === item.name.toLowerCase() && a.city.toLowerCase() === item.city.toLowerCase()
        );
        if (found) {
          scheduleAreas.push({
            id: `link-${schedId}-${found.id}`,
            brownoutScheduleId: schedId,
            areaId: found.id,
            rawAreaName: item.name,
            isMatched: true,
            matchedAreaId: found.id,
            cityHint: item.city
          });
        }
      }
    };

    linkAreas(sched1Id, [
      { name: 'Calamba', city: 'Cebu City' },
      { name: 'Capitol Site', city: 'Cebu City' },
      { name: 'Guadalupe', city: 'Cebu City' },
      { name: 'Labangon', city: 'Cebu City' },
      { name: 'Sambag 1', city: 'Cebu City' },
      { name: 'Sambag 2', city: 'Cebu City' },
      { name: 'Basak', city: 'Mandaue City' },
      { name: 'Centro', city: 'Mandaue City' },
      { name: 'Jagobiao', city: 'Mandaue City' },
      { name: 'Labogon', city: 'Mandaue City' },
      { name: 'Paknaan', city: 'Mandaue City' },
      { name: 'Tabok', city: 'Mandaue City' }
    ]);

    linkAreas(sched2Id, [
      { name: 'Apas', city: 'Cebu City' },
      { name: 'Lahug', city: 'Cebu City' },
      { name: 'Mabolo', city: 'Cebu City' },
      { name: 'Kasambagan', city: 'Cebu City' },
      { name: 'Banilad', city: 'Cebu City' },
      { name: 'Cansojong', city: 'Talisay City' },
      { name: 'Lawaan I', city: 'Talisay City' },
      { name: 'Linao', city: 'Talisay City' },
      { name: 'Mohon', city: 'Talisay City' },
      { name: 'San Isidro', city: 'Talisay City' },
      { name: 'Tabunok', city: 'Talisay City' }
    ]);

    linkAreas(sched3Id, [
      { name: 'Camputhaw', city: 'Cebu City' },
      { name: 'Tisa', city: 'Cebu City' },
      { name: 'Punta Princesa', city: 'Cebu City' },
      { name: 'Mambaling', city: 'Cebu City' },
      { name: 'Basak San Nicolas', city: 'Cebu City' },
      { name: 'Casili', city: 'Consolacion' },
      { name: 'Danlag', city: 'Consolacion' },
      { name: 'Jugan', city: 'Consolacion' },
      { name: 'Pitogo', city: 'Consolacion' },
      { name: 'Poblacion', city: 'Consolacion' }
    ]);

    this.data.scheduleAreas = scheduleAreas;
    this.save();
  }

  // AREA QUERIES
  public getAreas(): Area[] {
    return this.data.areas.filter(a => a.isActive !== false);
  }

  public getAreaById(id: string): Area | undefined {
    return this.data.areas.find(a => a.id === id);
  }

  public findAreaByNameAndCity(name: string, city: string): Area | null {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normCity = city.toLowerCase().trim();

    // 1. Exact match
    const exact = this.data.areas.find(
      a => a.name.toLowerCase() === name.toLowerCase() && a.city.toLowerCase() === normCity
    );
    if (exact) return exact;

    // 2. Normalized name match + city
    const normMatch = this.data.areas.find(
      a => a.normalizedName.replace(/[^a-z0-9]/g, '') === norm && a.city.toLowerCase() === normCity
    );
    if (normMatch) return normMatch;

    // 3. Fallback: match without city constraint if unique
    const broadMatches = this.data.areas.filter(
      a => a.normalizedName.replace(/[^a-z0-9]/g, '') === norm
    );
    if (broadMatches.length === 1) {
      return broadMatches[0];
    }

    // 4. Substring / token matching (e.g., "Duljo" matches "Duljo Fatima", "Zapatera" matches "Zapatera")
    const substringMatch = this.data.areas.find(a => {
      const aNorm = a.normalizedName.replace(/[^a-z0-9]/g, '');
      const cityMatches = a.city.toLowerCase() === normCity;
      return cityMatches && (aNorm.includes(norm) || norm.includes(aNorm));
    });
    if (substringMatch) return substringMatch;

    return null;
  }

  public findOrCreateArea(name: string, city: string): Area {
    const existing = this.findAreaByNameAndCity(name, city);
    if (existing) return existing;

    const cityCoords: Record<string, { lat: number; lng: number }> = {
      'cebu city': { lat: 10.3157, lng: 123.8854 },
      'mandaue city': { lat: 10.3323, lng: 123.9357 },
      'talisay city': { lat: 10.2520, lng: 123.8398 },
      'consolacion': { lat: 10.3750, lng: 123.9570 },
      'liloan': { lat: 10.4000, lng: 123.9830 },
      'lapu-lapu city': { lat: 10.3103, lng: 123.9494 },
      'minglanilla': { lat: 10.2450, lng: 123.7960 },
      'city of naga': { lat: 10.2080, lng: 123.7570 },
      'san fernando': { lat: 10.1600, lng: 123.7100 }
    };

    const normCity = (city || 'Cebu City').toLowerCase();
    const base = cityCoords[normCity] || cityCoords['cebu city'];
    
    // Deterministic small pseudo-random offset based on area name string to spread pins
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const offsetLat = ((Math.abs(hash) % 100) - 50) * 0.0003;
    const offsetLng = ((Math.abs(hash >> 3) % 100) - 50) * 0.0003;

    const newArea: Area = {
      id: `area-auto-${normCity.replace(/[^a-z0-9]/g, '')}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name: name,
      normalizedName: name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(),
      city: city || 'Cebu City',
      province: 'Cebu',
      latitude: parseFloat((base.lat + offsetLat).toFixed(4)),
      longitude: parseFloat((base.lng + offsetLng).toFixed(4)),
      isActive: true
    };

    // Check if ID already in memory
    const existingById = this.data.areas.find(a => a.id === newArea.id);
    if (existingById) return existingById;

    this.data.areas.push(newArea);
    this.save();
    return newArea;
  }

  public searchAreas(query: string): Area[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return this.data.areas.filter(
      a => a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
    );
  }

  public createArea(area: Omit<Area, 'id'>): Area {
    const newArea: Area = {
      ...area,
      id: `area-custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      isActive: true
    };
    this.data.areas.push(newArea);
    this.save();
    return newArea;
  }

  // POSTS & ADVISORIES
  public getPosts(status?: PostStatus): BrownoutPost[] {
    let posts = [...this.data.posts];
    if (status) {
      posts = posts.filter(p => p.status === status);
    }
    // Return sorted newest first
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return posts.map(p => this.attachSchedulesToPost(p));
  }

  public getPostById(id: string): BrownoutPost | null {
    const post = this.data.posts.find(p => p.id === id);
    if (!post) return null;
    return this.attachSchedulesToPost(post);
  }

  public getLatestPublishedAdvisory(): BrownoutPost | null {
    const published = this.data.posts
      .filter(p => p.status === 'Published')
      .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
    
    if (published.length === 0) return null;
    return this.attachSchedulesToPost(published[0]);
  }

  private attachSchedulesToPost(post: BrownoutPost): BrownoutPost {
    const schedules = this.data.schedules.filter(s => s.brownoutPostId === post.id);
    const schedulesWithAreas = schedules.map(s => {
      const links = this.data.scheduleAreas.filter(sa => sa.brownoutScheduleId === s.id);
      const areas = links.map(link => {
        const area = this.data.areas.find(a => a.id === link.areaId);
        if (area) {
          return { ...area, rawAreaName: link.rawAreaName, isMatched: link.isMatched };
        }
        return {
          id: link.areaId || `unmatched-${link.id}`,
          name: link.rawAreaName,
          normalizedName: link.rawAreaName.toLowerCase(),
          city: link.cityHint || 'Unknown City',
          province: 'Cebu',
          latitude: 10.3157,
          longitude: 123.8854,
          isActive: true,
          rawAreaName: link.rawAreaName,
          isMatched: link.isMatched
        };
      });
      return { ...s, areas };
    });

    return { ...post, schedules: schedulesWithAreas };
  }

  public createPostWithSchedules(postData: {
    title: string;
    originalContent: string;
    source: string;
    sourceUrl?: string;
    originalImagePath?: string;
    startDate: string;
    endDate: string;
    status: PostStatus;
    schedules: {
      scheduleDate: string;
      startTime: string;
      endTime: string;
      scheduleType: 'PossibleRotationalBrownout';
      areas: {
        rawAreaName: string;
        city: string;
        matchedAreaId?: string | null;
        isMatched: boolean;
      }[];
    }[];
  }): BrownoutPost {
    const postId = `post-${Date.now()}`;
    const newPost: BrownoutPost = {
      id: postId,
      title: postData.title,
      originalContent: postData.originalContent,
      source: postData.source,
      sourceUrl: postData.sourceUrl,
      originalImagePath: postData.originalImagePath,
      startDate: postData.startDate,
      endDate: postData.endDate,
      status: postData.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: postData.status === 'Published' ? new Date().toISOString() : null
    };

    this.data.posts.push(newPost);

    for (const s of postData.schedules) {
      const schedId = `sched-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const sched: BrownoutSchedule = {
        id: schedId,
        brownoutPostId: postId,
        scheduleDate: s.scheduleDate,
        startTime: s.startTime,
        endTime: s.endTime,
        scheduleType: s.scheduleType,
        status: 'Scheduled',
        createdAt: new Date().toISOString()
      };
      this.data.schedules.push(sched);

      for (const a of s.areas) {
        const linkId = `link-${schedId}-${Math.random().toString(36).substr(2, 5)}`;
        // Ensure every area has a geocoded Area record
        let areaId = a.matchedAreaId;
        if (!areaId) {
          const resolved = this.findOrCreateArea(a.rawAreaName, a.city || 'Cebu City');
          areaId = resolved.id;
        }
        this.data.scheduleAreas.push({
          id: linkId,
          brownoutScheduleId: schedId,
          areaId: areaId,
          rawAreaName: a.rawAreaName,
          isMatched: true,
          matchedAreaId: areaId,
          cityHint: a.city
        });
      }
    }

    this.save();
    return this.attachSchedulesToPost(newPost);
  }

  public updatePostWithSchedules(id: string, updateData: {
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
      scheduleType: 'PossibleRotationalBrownout';
      areas: {
        rawAreaName: string;
        city: string;
        matchedAreaId?: string | null;
        isMatched?: boolean;
      }[];
    }[];
  }): BrownoutPost | null {
    const postIndex = this.data.posts.findIndex(p => p.id === id);
    if (postIndex === -1) return null;

    const post = this.data.posts[postIndex];
    post.title = updateData.title;
    post.source = updateData.source;
    post.sourceUrl = updateData.sourceUrl;
    post.startDate = updateData.startDate;
    post.endDate = updateData.endDate;
    post.updatedAt = new Date().toISOString();
    if (updateData.status) {
      post.status = updateData.status;
      if (updateData.status === 'Published') {
        post.publishedAt = new Date().toISOString();
      }
    }

    // Remove existing schedules and schedule-areas for this post
    const existingSchedIds = this.data.schedules
      .filter(s => s.brownoutPostId === id)
      .map(s => s.id);

    this.data.scheduleAreas = this.data.scheduleAreas.filter(
      sa => !existingSchedIds.includes(sa.brownoutScheduleId)
    );
    this.data.schedules = this.data.schedules.filter(s => s.brownoutPostId !== id);

    // Re-create updated schedules
    for (const s of updateData.schedules) {
      const schedId = s.id || `sched-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const sched: BrownoutSchedule = {
        id: schedId,
        brownoutPostId: id,
        scheduleDate: s.scheduleDate,
        startTime: s.startTime,
        endTime: s.endTime,
        scheduleType: s.scheduleType,
        status: 'Scheduled',
        createdAt: new Date().toISOString()
      };
      this.data.schedules.push(sched);

      for (const a of s.areas) {
        const linkId = `link-${schedId}-${Math.random().toString(36).substr(2, 5)}`;
        // Ensure every area has a geocoded Area record
        let areaId = a.matchedAreaId;
        if (!areaId) {
          const resolved = this.findOrCreateArea(a.rawAreaName, a.city || 'Cebu City');
          areaId = resolved.id;
        }
        this.data.scheduleAreas.push({
          id: linkId,
          brownoutScheduleId: schedId,
          areaId: areaId,
          rawAreaName: a.rawAreaName,
          isMatched: true,
          matchedAreaId: areaId,
          cityHint: a.city
        });
      }
    }

    this.save();
    return this.attachSchedulesToPost(post);
  }

  public setPostStatus(id: string, status: PostStatus): BrownoutPost | null {
    const post = this.data.posts.find(p => p.id === id);
    if (!post) return null;
    post.status = status;
    post.updatedAt = new Date().toISOString();
    if (status === 'Published') {
      post.publishedAt = new Date().toISOString();

      // Ensure any linked schedule areas have valid areaIds
      const postSchedIds = this.data.schedules
        .filter(s => s.brownoutPostId === id)
        .map(s => s.id);

      for (const sa of this.data.scheduleAreas) {
        if (postSchedIds.includes(sa.brownoutScheduleId)) {
          if (!sa.areaId || !this.data.areas.some(a => a.id === sa.areaId)) {
            const resolved = this.findOrCreateArea(sa.rawAreaName, sa.cityHint || 'Cebu City');
            sa.areaId = resolved.id;
            sa.matchedAreaId = resolved.id;
            sa.isMatched = true;
          }
        }
      }
    }
    this.save();
    return this.attachSchedulesToPost(post);
  }

  // DUPLICATE DETECTION
  public checkDuplicateAdvisory(title: string, source: string, startDate: string, endDate: string, content: string): {
    isDuplicate: boolean;
    existingAdvisory?: BrownoutPost;
    message?: string;
  } {
    const existing = this.data.posts.find(p => {
      // Check for same date range and source
      const sameDates = p.startDate === startDate && p.endDate === endDate;
      const sameSource = p.source.toLowerCase() === source.toLowerCase();
      const sameTitle = p.title.toLowerCase().trim() === title.toLowerCase().trim();

      // Check content similarity (first 100 characters)
      const contentSnippet = content.slice(0, 100).toLowerCase().replace(/\s+/g, ' ').trim();
      const existingSnippet = p.originalContent.slice(0, 100).toLowerCase().replace(/\s+/g, ' ').trim();
      const similarContent = contentSnippet.length > 20 && existingSnippet.includes(contentSnippet);

      return (sameDates && (sameTitle || sameSource)) || similarContent;
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingAdvisory: existing,
        message: `An advisory with similar date range (${existing.startDate} - ${existing.endDate}) or title already exists in ${existing.status} status.`
      };
    }

    return { isDuplicate: false };
  }

  // PUBLIC QUERIES: Active schedules with areas
  public getPublishedSchedules(): { post: BrownoutPost; schedules: BrownoutSchedule[]; areasByScheduleId: Record<string, Area[]> } {
    const latestPost = this.getLatestPublishedAdvisory();
    if (!latestPost) {
      return { post: null as any, schedules: [], areasByScheduleId: {} };
    }

    const schedules = this.data.schedules.filter(s => s.brownoutPostId === latestPost.id);
    const areasByScheduleId: Record<string, Area[]> = {};

    for (const s of schedules) {
      const links = this.data.scheduleAreas.filter(sa => sa.brownoutScheduleId === s.id);
      const areas: Area[] = [];
      for (const l of links) {
        let a = this.data.areas.find(area => area.id === l.areaId);
        if (!a && l.rawAreaName) {
          a = this.findOrCreateArea(l.rawAreaName, l.cityHint || 'Cebu City');
        }
        if (a) areas.push(a);
      }
      areasByScheduleId[s.id] = areas;
    }

    return {
      post: latestPost,
      schedules,
      areasByScheduleId
    };
  }

  public getSchedulesForArea(areaId: string): { schedule: BrownoutSchedule; post: BrownoutPost }[] {
    const links = this.data.scheduleAreas.filter(sa => sa.areaId === areaId);
    const results: { schedule: BrownoutSchedule; post: BrownoutPost }[] = [];

    for (const link of links) {
      const schedule = this.data.schedules.find(s => s.id === link.brownoutScheduleId);
      if (schedule) {
        const post = this.data.posts.find(p => p.id === schedule.brownoutPostId && p.status === 'Published');
        if (post) {
          results.push({ schedule, post });
        }
      }
    }

    return results;
  }

  // AUTH
  public getAdminUser(username: string): DbUser | undefined {
    return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  public getDashboardStats(): {
    publishedAdvisories: number;
    draftAdvisories: number;
    archivedAdvisories: number;
    activeSchedules: number;
    affectedAreasCount: number;
    totalKnownAreas: number;
    latestAdvisory: BrownoutPost | null;
  } {
    const published = this.data.posts.filter(p => p.status === 'Published').length;
    const drafts = this.data.posts.filter(p => p.status === 'Draft').length;
    const archived = this.data.posts.filter(p => p.status === 'Archived').length;

    const latest = this.getLatestPublishedAdvisory();
    let activeSchedules = 0;
    const uniqueAreaIds = new Set<string>();

    if (latest) {
      const schedules = this.data.schedules.filter(s => s.brownoutPostId === latest.id);
      activeSchedules = schedules.length;
      const links = this.data.scheduleAreas.filter(sa => schedules.some(s => s.id === sa.brownoutScheduleId));
      for (const l of links) {
        if (l.areaId) uniqueAreaIds.add(l.areaId);
      }
    }

    return {
      publishedAdvisories: published,
      draftAdvisories: drafts,
      archivedAdvisories: archived,
      activeSchedules,
      affectedAreasCount: uniqueAreaIds.size,
      totalKnownAreas: this.data.areas.length,
      latestAdvisory: latest
    };
  }
}
