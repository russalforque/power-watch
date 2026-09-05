// server/controllers/apiRoutes.ts

import { Router, Request, Response } from 'express';
import { Database } from '../data/database.js';
import { AdvisoryParserService } from '../parsers/AdvisoryParserService.js';
import { OcrService } from '../services/OcrService.js';
import { AuthService } from '../services/AuthService.js';
import { requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { AdvisoryImportRequest, UpdateAdvisoryRequest, PostStatus } from '../../src/types/index.js';

export function createApiRouter(): Router {
  const router = Router();
  const db = Database.getInstance();
  const ocrService = new OcrService();
  const authService = new AuthService();

  const lookupProvider = {
    findAreaByNameAndCity: (name: string, city: string) => db.findAreaByNameAndCity(name, city)
  };
  const parser = new AdvisoryParserService(lookupProvider);

  // ==========================================
  // AUTHENTICATION ROUTES
  // ==========================================
  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({
          success: false,
          message: 'Username and password are required.'
        });
        return;
      }

      const result = await authService.login(username, password);
      if (!result) {
        res.status(401).json({
          success: false,
          message: 'Invalid administrator credentials.'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Admin authentication successful.',
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/auth/me', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: req.user
    });
  });

  // ==========================================
  // PUBLIC ADVISORY & SCHEDULE ROUTES
  // ==========================================
  
  // GET /api/advisories/active
  router.get('/advisories/active', (req: Request, res: Response) => {
    try {
      const { post, schedules, areasByScheduleId } = db.getPublishedSchedules();
      if (!post) {
        res.json({
          success: true,
          data: null,
          message: 'No active published advisory found.'
        });
        return;
      }

      const scheduleGroups = schedules.map(s => {
        const areas = areasByScheduleId[s.id] || [];
        const cityMap: Record<string, typeof areas> = {};
        for (const a of areas) {
          if (!cityMap[a.city]) cityMap[a.city] = [];
          cityMap[a.city].push(a);
        }

        const areasByCity = Object.keys(cityMap).map(city => ({
          city,
          areas: cityMap[city].sort((a, b) => a.name.localeCompare(b.name))
        }));

        return {
          id: s.id,
          scheduleDate: s.scheduleDate,
          timeWindow: `${s.startTime} – ${s.endTime}`,
          startTime: s.startTime,
          endTime: s.endTime,
          scheduleType: s.scheduleType,
          advisoryTitle: post.title,
          source: post.source,
          sourceUrl: post.sourceUrl,
          updatedAt: post.updatedAt,
          areasByCity,
          totalAreas: areas.length
        };
      });

      res.json({
        success: true,
        data: {
          advisory: post,
          schedules: scheduleGroups,
          lastUpdated: post.updatedAt,
          publishedAt: post.publishedAt
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/advisories (public: published only)
  router.get('/advisories', (req: Request, res: Response) => {
    try {
      const posts = db.getPosts('Published');
      res.json({
        success: true,
        data: posts
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/advisories/:id
  router.get('/advisories/:id', (req: Request, res: Response) => {
    try {
      const post = db.getPostById(req.params.id);
      if (!post) {
        res.status(404).json({
          success: false,
          message: 'Advisory not found.'
        });
        return;
      }
      res.json({
        success: true,
        data: post
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // PUBLIC AREA ROUTES
  // ==========================================
  
  // GET /api/areas
  router.get('/areas', (req: Request, res: Response) => {
    try {
      const areas = db.getAreas();
      res.json({
        success: true,
        data: areas
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/areas/search?q=guadalupe
  router.get('/areas/search', (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || '');
      const results = db.searchAreas(q);
      res.json({
        success: true,
        data: results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/areas/:id/schedules
  router.get('/areas/:id/schedules', (req: Request, res: Response) => {
    try {
      const area = db.getAreaById(req.params.id);
      if (!area) {
        res.status(404).json({ success: false, message: 'Area not found' });
        return;
      }
      const schedules = db.getSchedulesForArea(req.params.id);
      res.json({
        success: true,
        data: {
          area,
          schedules
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // ADMIN ROUTES (PROTECTED)
  // ==========================================

  // GET /api/admin/dashboard/stats
  router.get('/admin/dashboard/stats', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = db.getDashboardStats();
      const recentPosts = db.getPosts();
      res.json({
        success: true,
        data: {
          ...stats,
          recentAdvisories: recentPosts.slice(0, 10)
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/admin/advisories (all statuses)
  router.get('/admin/advisories', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.query.status as PostStatus | undefined;
      const posts = db.getPosts(status);
      res.json({
        success: true,
        data: posts
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/admin/ocr/status
  router.get('/admin/ocr/status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const available = await ocrService.isServiceAvailable();
    res.json({
      success: true,
      data: {
        isAvailable: available,
        engine: available ? 'Gemini Flash Vision OCR' : 'Manual Text Paste Priority'
      }
    });
  });

  // POST /api/admin/advisories/import
  router.post('/admin/advisories/import', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body: AdvisoryImportRequest = req.body;
      let textToParse = body.text || '';

      if (!textToParse.trim() && body.imageDataUrl) {
        const ocrResult = await ocrService.extractTextFromImage(body.imageDataUrl);
        if (ocrResult.isAvailable && ocrResult.extractedText) {
          textToParse = ocrResult.extractedText;
        } else {
          res.status(400).json({
            success: false,
            message: ocrResult.message || 'Could not extract text from the provided image. Please paste the Facebook post text directly.',
            errors: [ocrResult.message || 'OCR unavailable']
          });
          return;
        }
      }

      if (!textToParse || textToParse.trim().length < 10) {
        res.status(400).json({
          success: false,
          message: 'Advisory text is required. Please paste the Facebook advisory text.',
          errors: ['Empty or insufficient advisory content']
        });
        return;
      }

      const parsed = await parser.parse(textToParse, {
        sourceUrl: body.sourceUrl,
        defaultSource: body.source || 'Visayan Electric'
      });

      const duplicateCheck = db.checkDuplicateAdvisory(
        parsed.title,
        parsed.source,
        parsed.startDate,
        parsed.endDate,
        textToParse
      );

      const savedPost = db.createPostWithSchedules({
        title: parsed.title,
        originalContent: textToParse,
        source: parsed.source,
        sourceUrl: parsed.sourceUrl,
        originalImagePath: body.imageFileName,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        status: 'Draft',
        schedules: parsed.schedules.map(s => ({
          scheduleDate: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          scheduleType: s.scheduleType,
          areas: s.areas.map(a => ({
            rawAreaName: a.rawName,
            city: a.city,
            matchedAreaId: a.matchedAreaId,
            isMatched: a.isMatched
          }))
        }))
      });

      res.json({
        success: true,
        message: 'Advisory successfully parsed and saved as Draft for review.',
        data: {
          advisory: savedPost,
          parsedResult: parsed,
          duplicateWarning: duplicateCheck
        }
      });
    } catch (err: any) {
      console.error('Import error:', err);
      res.status(500).json({
        success: false,
        message: 'Unable to parse advisory.',
        errors: [err.message || 'Parsing failure']
      });
    }
  });

  // POST /api/admin/advisories/:id/parse (re-parse original text)
  router.post('/admin/advisories/:id/parse', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const post = db.getPostById(req.params.id);
      if (!post) {
        res.status(404).json({ success: false, message: 'Advisory not found' });
        return;
      }

      const parsed = await parser.parse(post.originalContent, {
        sourceUrl: post.sourceUrl,
        defaultSource: post.source
      });

      if (parsed.schedules.length > 0) {
        db.updatePostWithSchedules(req.params.id, {
          title: post.title && post.title !== 'ADVISORY: POSSIBLE ROTATIONAL BROWNOUTS' ? post.title : parsed.title,
          source: post.source || parsed.source,
          sourceUrl: post.sourceUrl || parsed.sourceUrl,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          status: post.status,
          schedules: parsed.schedules.map(s => ({
            scheduleDate: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            scheduleType: s.scheduleType || 'PossibleRotationalBrownout',
            areas: s.areas.map(a => ({
              rawAreaName: a.rawName,
              city: a.city,
              matchedAreaId: a.matchedAreaId,
              isMatched: Boolean(a.matchedAreaId)
            }))
          }))
        });
      }

      res.json({
        success: true,
        message: 'Advisory re-parsed successfully.',
        data: parsed
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // PUT /api/admin/advisories/:id (correct / update schedules, areas, dates)
  router.put('/admin/advisories/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const body: UpdateAdvisoryRequest = req.body;

      const errors: string[] = [];
      if (!body.title || !body.title.trim()) errors.push('Title is required.');
      if (!body.source || !body.source.trim()) errors.push('Source is required.');
      if (!body.startDate) errors.push('Start Date is required.');
      if (!body.endDate) errors.push('End Date is required.');
      if (body.startDate > body.endDate) errors.push('End Date cannot be before Start Date.');

      if (!body.schedules || body.schedules.length === 0) {
        errors.push('At least one schedule is required.');
      } else {
        body.schedules.forEach((s, idx) => {
          if (!s.scheduleDate) errors.push(`Schedule #${idx + 1}: Schedule date is required.`);
          if (!s.startTime) errors.push(`Schedule #${idx + 1}: Start time is required.`);
          if (!s.endTime) errors.push(`Schedule #${idx + 1}: End time is required.`);
          if (!s.areas || s.areas.length === 0) {
            errors.push(`Schedule #${idx + 1} (${s.startTime} - ${s.endTime}): At least one affected area is required.`);
          }
        });
      }

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors
        });
        return;
      }

      const updated = db.updatePostWithSchedules(id, {
        title: body.title,
        source: body.source,
        sourceUrl: body.sourceUrl,
        startDate: body.startDate,
        endDate: body.endDate,
        status: body.status,
        schedules: body.schedules.map(s => ({
          id: s.id,
          scheduleDate: s.scheduleDate,
          startTime: s.startTime,
          endTime: s.endTime,
          scheduleType: s.scheduleType || 'PossibleRotationalBrownout',
          areas: s.areas.map(a => ({
            rawAreaName: a.rawAreaName,
            city: a.city,
            matchedAreaId: a.matchedAreaId,
            isMatched: Boolean(a.matchedAreaId)
          }))
        }))
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'Advisory not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Advisory details saved successfully.',
        data: updated
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/admin/advisories/:id/publish (FIXED: Removed duplicate /api)
  router.post('/admin/advisories/:id/publish', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      let post = db.getPostById(id);
      if (!post) {
        res.status(404).json({ success: false, message: 'Advisory not found' });
        return;
      }

      if (req.body && (req.body.title || req.body.schedules)) {
        const body: UpdateAdvisoryRequest = req.body;
        db.updatePostWithSchedules(id, {
          title: body.title || post.title,
          source: body.source || post.source,
          sourceUrl: body.sourceUrl ?? post.sourceUrl,
          startDate: body.startDate || post.startDate,
          endDate: body.endDate || post.endDate,
          status: 'Published',
          schedules: (body.schedules || []).map(s => ({
            id: s.id,
            scheduleDate: s.scheduleDate,
            startTime: s.startTime,
            endTime: s.endTime,
            scheduleType: s.scheduleType || 'PossibleRotationalBrownout',
            areas: (s.areas || []).map(a => ({
              rawAreaName: a.rawAreaName,
              city: a.city,
              matchedAreaId: a.matchedAreaId,
              isMatched: Boolean(a.matchedAreaId)
            }))
          }))
        });
        post = db.getPostById(id)!;
      }

      if ((!post.schedules || post.schedules.length === 0) && post.originalContent) {
        try {
          const parsed = await parser.parse(post.originalContent, {
            sourceUrl: post.sourceUrl,
            defaultSource: post.source
          });
          if (parsed.schedules.length > 0) {
            db.updatePostWithSchedules(id, {
              title: post.title && post.title !== 'ADVISORY: POSSIBLE ROTATIONAL BROWNOUTS' ? post.title : parsed.title,
              source: post.source || parsed.source,
              sourceUrl: post.sourceUrl || parsed.sourceUrl,
              startDate: post.startDate || parsed.startDate,
              endDate: post.endDate || parsed.endDate,
              status: 'Published',
              schedules: parsed.schedules.map(s => ({
                scheduleDate: s.date,
                startTime: s.startTime,
                endTime: s.endTime,
                scheduleType: s.scheduleType || 'PossibleRotationalBrownout',
                areas: s.areas.map(a => ({
                  rawAreaName: a.rawName,
                  city: a.city,
                  matchedAreaId: a.matchedAreaId,
                  isMatched: Boolean(a.matchedAreaId)
                }))
              }))
            });
            post = db.getPostById(id)!;
          }
        } catch (autoErr) {
          console.error('Auto re-parse on publish failed:', autoErr);
        }
      }

      const errors: string[] = [];
      if (!post.title || !post.title.trim()) errors.push('Advisory title is required.');
      if (!post.startDate || !post.endDate) errors.push('Start and End dates are required.');
      if (post.startDate > post.endDate) errors.push('End Date cannot be before Start Date.');
      if (!post.schedules || post.schedules.length === 0) {
        errors.push('Cannot publish advisory with 0 schedules. Please define at least one schedule window.');
      } else {
        let totalAreas = 0;
        post.schedules.forEach((s, idx) => {
          if (!s.startTime || !s.endTime) {
            errors.push(`Schedule #${idx + 1}: Start and End times are required.`);
          }
          if (!s.areas || s.areas.length === 0) {
            errors.push(`Schedule #${idx + 1} (${s.startTime || 'TBD'} - ${s.endTime || 'TBD'}): Must have at least one affected area.`);
          } else {
            totalAreas += s.areas.length;
          }
        });
        if (totalAreas === 0) {
          errors.push('Cannot publish an advisory without any affected areas.');
        }
      }

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot publish incomplete advisory.',
          errors
        });
        return;
      }

      const published = db.setPostStatus(id, 'Published');
      res.json({
        success: true,
        message: 'Advisory published successfully to the public map.',
        data: published
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/admin/advisories/:id/archive (FIXED: Removed duplicate /api)
  router.post('/admin/advisories/:id/archive', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const archived = db.setPostStatus(id, 'Archived');
      if (!archived) {
        res.status(404).json({ success: false, message: 'Advisory not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Advisory archived successfully.',
        data: archived
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/admin/areas (ADDED: Resolves areaService.getAreas() 404s)
  router.get('/admin/areas', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const areas = db.getAreas();
      res.json({
        success: true,
        data: areas
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/admin/areas (FIXED: Removed duplicate /api)
  router.post('/admin/areas', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, city, province, latitude, longitude } = req.body;
      if (!name || !city) {
        res.status(400).json({ success: false, message: 'Name and City are required.' });
        return;
      }

      const newArea = db.createArea({
        name: name.trim(),
        normalizedName: name.trim().toLowerCase(),
        city: city.trim(),
        province: province || 'Cebu',
        latitude: parseFloat(latitude) || 10.3157,
        longitude: parseFloat(longitude) || 123.8854,
        isActive: true
      });

      res.json({
        success: true,
        message: 'Area created successfully.',
        data: newArea
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}