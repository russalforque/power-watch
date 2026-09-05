import assert from 'node:assert/strict';
import { Database } from '../server/data/database.js';
import { AuthService } from '../server/services/AuthService.js';
import { AdvisoryParserService } from '../server/parsers/AdvisoryParserService.js';

async function runApiTests() {
  console.log('--- RUNNING POWERWATCH CORE & API INTEGRATION TESTS ---');

  const db = Database.getInstance();
  const auth = new AuthService();
  const parser = new AdvisoryParserService({
    findAreaByNameAndCity: (name, city) => db.findAreaByNameAndCity(name, city)
  });

  // 1. Authentication: Valid admin
  console.log('Testing Admin Authentication...');
  const validLogin = await auth.login('admin', 'AdminPowerWatch2026!');
  assert.ok(validLogin !== null, 'Valid admin login should succeed');
  assert.equal(validLogin?.user.username, 'admin');
  assert.equal(validLogin?.user.role, 'Admin');
  assert.ok(validLogin?.token, 'JWT token must be returned');

  // Verify token
  const verified = auth.verifyToken(validLogin!.token);
  assert.equal(verified?.username, 'admin');

  // 2. Authentication: Invalid password
  const invalidLogin = await auth.login('admin', 'WrongPassword123');
  assert.equal(invalidLogin, null, 'Invalid login should return null');

  // 3. Duplicate Detection Check
  console.log('Testing Duplicate Advisory Detection...');
  const existingPost = db.getPosts()[0];
  const duplicateCheck = db.checkDuplicateAdvisory(
    existingPost.title,
    existingPost.source,
    existingPost.startDate,
    existingPost.endDate,
    existingPost.originalContent
  );
  assert.ok(duplicateCheck.isDuplicate, 'Should detect existing advisory with same title and date');
  assert.ok(duplicateCheck.message?.includes('similar'), 'Should return clear warning message');

  // 4. Safe Draft Creation (Never auto-published)
  console.log('Testing Safe Draft Import Workflow...');
  const testAdvisoryText = `ADVISORY: POSSIBLE ROTATIONAL BROWNOUTS
DAILY | SEPTEMBER 10, 2026
02:00 PM - 04:30 PM
Cebu City: Guadalupe, Lahug
Mandaue City: Centro`;

  const parsed = await parser.parse(testAdvisoryText, { defaultSource: 'Visayan Electric' });
  assert.equal(parsed.schedules.length, 1);

  const draft = db.createPostWithSchedules({
    title: parsed.title,
    originalContent: testAdvisoryText,
    source: parsed.source,
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

  assert.equal(draft.status, 'Draft', 'Advisory must initially be Draft');
  assert.equal(db.getPostById(draft.id)?.status, 'Draft');

  // 5. Update Advisory (Edit times and areas)
  console.log('Testing Admin Manual Editing of Draft...');
  const updated = db.updatePostWithSchedules(draft.id, {
    title: 'CORRECTED TITLE: BROWNOUT SCHEDULE',
    source: 'Visayan Electric',
    startDate: '2026-09-10',
    endDate: '2026-09-10',
    status: 'Draft',
    schedules: [
      {
        scheduleDate: '2026-09-10',
        startTime: '02:00 PM',
        endTime: '04:30 PM',
        scheduleType: 'PossibleRotationalBrownout',
        areas: [
          { rawAreaName: 'Guadalupe', city: 'Cebu City', isMatched: true },
          { rawAreaName: 'Lahug', city: 'Cebu City', isMatched: true },
          { rawAreaName: 'Mabolo', city: 'Cebu City', isMatched: true }
        ]
      }
    ]
  });
  assert.equal(updated?.title, 'CORRECTED TITLE: BROWNOUT SCHEDULE');
  assert.equal(updated?.schedules[0].areas.length, 3);

  // 6. Publish Advisory Workflow
  console.log('Testing Publish Workflow...');
  const published = db.setPostStatus(draft.id, 'Published');
  assert.equal(published?.status, 'Published');
  assert.ok(published?.publishedAt, 'publishedAt timestamp must be set');

  // Verify published schedules appear in public active query
  const publicSchedules = db.getPublishedSchedules();
  assert.ok(publicSchedules.post !== null, 'Public schedules must have an active post');

  // 7. Archive Advisory
  console.log('Testing Archive Workflow...');
  const archived = db.setPostStatus(draft.id, 'Archived');
  assert.equal(archived?.status, 'Archived');

  console.log(' ALL CORE & API INTEGRATION TESTS PASSED! \n');
}

runApiTests().catch(err => {
  console.error('API Test Failed:', err);
  process.exit(1);
});
