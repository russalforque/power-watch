import assert from 'node:assert';
import { AdvisoryParserService } from '../server/parsers/AdvisoryParserService.js';
import { SEED_AREAS } from '../server/data/seedAreas.js';

// Mock lookup provider using SEED_AREAS
const mockLookup = {
  findAreaByNameAndCity(name: string, city: string) {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normCity = city.toLowerCase().trim();
    const found = SEED_AREAS.find(
      a => a.normalizedName.replace(/[^a-z0-9]/g, '') === norm && a.city.toLowerCase() === normCity
    );
    return found ? { id: found.id, name: found.name, city: found.city } : null;
  }
};

async function runTests() {
  const parser = new AdvisoryParserService(mockLookup);
  console.log('--- RUNNING ADVISORY PARSER TEST SUITE (10 TESTS) ---');

  // Test 1: One time slot + one city
  {
    console.log('Testing Test 1: One time slot + one city...');
    const text = `ADVISORY: POSSIBLE ROTATIONAL BROWNOUT
SEPTEMBER 5, 2026
10:00 AM - 12:30 PM
Cebu City: Guadalupe, Lahug, Apas`;
    const result = await parser.parse(text);
    assert.strictEqual(result.schedules.length, 1, 'Should parse 1 schedule');
    assert.strictEqual(result.schedules[0].startTime, '10:00 AM');
    assert.strictEqual(result.schedules[0].endTime, '12:30 PM');
    assert.strictEqual(result.schedules[0].areas.length, 3, 'Should parse 3 areas in Cebu City');
    assert.strictEqual(result.schedules[0].areas[0].rawName, 'Guadalupe');
    assert.strictEqual(result.schedules[0].areas[0].isMatched, true);
    console.log('✓ Test 1 passed');
  }

  // Test 2: One time slot + multiple cities
  {
    console.log('Testing Test 2: One time slot + multiple cities...');
    const text = `ADVISORY: POSSIBLE ROTATIONAL BROWNOUT
SEPTEMBER 5, 2026
10:00 AM - 12:30 PM
Cebu City: Guadalupe, Lahug
Mandaue City: Basak, Centro
Talisay City: Cansojong, Tabunok`;
    const result = await parser.parse(text);
    assert.strictEqual(result.schedules.length, 1);
    assert.strictEqual(result.schedules[0].areas.length, 6, 'Should extract 6 areas across 3 cities');
    const cities = new Set(result.schedules[0].areas.map(a => a.city));
    assert.strictEqual(cities.has('Cebu City'), true);
    assert.strictEqual(cities.has('Mandaue City'), true);
    assert.strictEqual(cities.has('Talisay City'), true);
    console.log('✓ Test 2 passed');
  }

  // Test 3: Multiple time slots
  {
    console.log('Testing Test 3: Multiple time slots...');
    const text = `ADVISORY: POSSIBLE ROTATIONAL BROWNOUTS
SEPTEMBER 5, 2026
10:00 AM - 12:30 PM
Cebu City: Guadalupe, Labangon

01:00 PM - 03:30 PM
Cebu City: Apas, Lahug

04:00 PM - 06:30 PM
Mandaue City: Basak, Centro`;
    const result = await parser.parse(text);
    assert.strictEqual(result.schedules.length, 3, 'Should extract 3 distinct time window schedules');
    assert.strictEqual(result.schedules[0].startTime, '10:00 AM');
    assert.strictEqual(result.schedules[1].startTime, '1:00 PM');
    assert.strictEqual(result.schedules[2].startTime, '4:00 PM');
    console.log('✓ Test 3 passed');
  }

  // Test 4: Multiple occurrences of the same city in the same time slot
  {
    console.log('Testing Test 4: Multiple occurrences of the same city...');
    const text = `ADVISORY: POSSIBLE ROTATIONAL BROWNOUT
SEPTEMBER 5, 2026
10:00 AM - 12:30 PM
Cebu City: Calamba, Capitol Site, Guadalupe
Cebu City: Agsungot, Apas, Babag, Binaliw
Mandaue City: Basak, Centro`;
    const result = await parser.parse(text);
    assert.strictEqual(result.schedules.length, 1);
    const cebuCityAreas = result.schedules[0].areas.filter(a => a.city === 'Cebu City');
    assert.strictEqual(cebuCityAreas.length, 7, 'Should merge all Cebu City lines into the schedule');
    console.log('✓ Test 4 passed');
  }

  // Test 5: Multiple areas
  {
    console.log('Testing Test 5: Multiple areas parsing...');
    const text = `ADVISORY: POSSIBLE ROTATIONAL BROWNOUT
SEPTEMBER 5, 2026
10:00 AM - 12:30 PM
Cebu City: Calamba, Capitol Site, Guadalupe, Labangon, Sambag 1, Sambag 2, Camputhaw, Kasambagan, Banilad, Tisa`;
    const result = await parser.parse(text);
    assert.strictEqual(result.schedules[0].areas.length, 10, 'Should parse all 10 areas');
    console.log('✓ Test 5 passed');
  }

  // Test 6: Unrecognized area
  {
    console.log('Testing Test 6: Unrecognized area flagging...');
    const text = `ADVISORY: POSSIBLE ROTATIONAL BROWNOUT
SEPTEMBER 5, 2026
10:00 AM - 12:30 PM
Cebu City: Guadalupe, SitiodelaCruzFictionalArea, Labangon`;
    const result = await parser.parse(text);
    const unrecognized = result.schedules[0].areas.find(a => a.rawName === 'SitiodelaCruzFictionalArea');
    assert(unrecognized, 'Unrecognized area should be preserved, not discarded');
    assert.strictEqual(unrecognized.isMatched, false, 'Should be flagged as unmatched');
    assert.strictEqual(result.unrecognizedAreasCount, 1);
    console.log('✓ Test 6 passed');
  }

  // Test 7: Date range detection
  {
    console.log('Testing Test 7: Date range detection...');
    const text = `ADVISORY: REVISED POSSIBLE ROTATIONAL BROWNOUTS
DAILY | SEPTEMBER 3-6, 2026
10:00 AM - 12:30 PM
Cebu City: Guadalupe`;
    const result = await parser.parse(text, { referenceYear: 2026 });
    assert.strictEqual(result.startDate, '2026-09-03');
    assert.strictEqual(result.endDate, '2026-09-06');
    console.log('✓ Test 7 passed');
  }

  // Test 8: Malformed schedule / noisy text
  {
    console.log('Testing Test 8: Malformed schedule handling...');
    const text = `ADVISORY: EMERGENCY
Some random preamble without dates...
⚡⚡⚡ ATTENTION CUSTOMERS ⚡⚡⚡
10:00 AM - 12:30 PM
Cebu City: Guadalupe, Lahug
Random footer message: please unplug appliances during brownouts.`;
    const result = await parser.parse(text);
    assert.strictEqual(result.schedules.length, 1, 'Should still cleanly recover schedule');
    assert.strictEqual(result.schedules[0].areas.length, 2);
    console.log('✓ Test 8 passed');
  }

  // Test 9: Duplicate area within a schedule
  {
    console.log('Testing Test 9: Duplicate area within a schedule...');
    const text = `ADVISORY: POSSIBLE ROTATIONAL BROWNOUT
SEPTEMBER 5, 2026
10:00 AM - 12:30 PM
Cebu City: Guadalupe, Lahug, Guadalupe, LAHUG, Apas`;
    const result = await parser.parse(text);
    assert.strictEqual(result.schedules[0].areas.length, 3, 'Should deduplicate repeated areas within the same schedule');
    console.log('✓ Test 9 passed');
  }

  // Test 10: Realistic Visayan Electric advisory text
  {
    console.log('Testing Test 10: Realistic Visayan Electric advisory text...');
    const text = `ADVISORY: REVISED POSSIBLE ROTATIONAL BROWNOUTS
DAILY | SEPTEMBER 3-6, 2026
10:00AM–11:00PM

Due to the current power supply situation, Visayan Electric will implement possible rotational brownouts.

10:00 AM–12:30 PM
Cebu City: Calamba, Capitol Site, Guadalupe, Labangon, Sambag 1, Sambag 2
Cebu City: Agsungot, Apas, Babag, Binaliw, Bonbon, Buot, Busay, Camputhaw, Guba, Lahug, Malubog, Pulangbato, Pung-ol Sibugay, San Roque, Sirao, Tabunan, Tagba-o, Taptap
Mandaue City: Basak, Centro, Jagobiao, Labogon, Paknaan, Tabok

01:00 PM–03:30 PM
Cebu City: Mabolo, Kasambagan, Banilad, Tisa, Punta Princesa, Mambaling, Basak San Nicolas
Talisay City: Cansojong, Lawaan I, Linao, Mohon, San Isidro, San Roque, Tabunok, Tangke

Source: Visayan Electric
Please stay tuned to our official page for updates.`;
    const result = await parser.parse(text, { referenceYear: 2026, sourceUrl: 'https://www.facebook.com/visayanelectric' });
    assert.strictEqual(result.schedules.length, 2, 'Should extract both schedules');
    assert.strictEqual(result.title.includes('REVISED POSSIBLE ROTATIONAL BROWNOUTS'), true);
    assert.strictEqual(result.startDate, '2026-09-03');
    assert.strictEqual(result.endDate, '2026-09-06');
    assert.strictEqual(result.sourceUrl, 'https://www.facebook.com/visayanelectric');
    
    // First slot: 6 + 18 + 6 = 30 areas
    const slot1 = result.schedules[0];
    assert.strictEqual(slot1.startTime, '10:00 AM');
    assert.strictEqual(slot1.endTime, '12:30 PM');
    assert.strictEqual(slot1.areas.length, 30);

    // Second slot: 7 + 8 = 15 areas
    const slot2 = result.schedules[1];
    assert.strictEqual(slot2.startTime, '1:00 PM');
    assert.strictEqual(slot2.endTime, '3:30 PM');
    assert.strictEqual(slot2.areas.length, 15);

    console.log('✓ Test 10 passed');
  }

  console.log('\n ALL 10 PARSER TESTS PASSED SUCCESSFULLY! \n');
}

runTests().catch(err => {
  console.error('Parser test failed:', err);
  process.exit(1);
});
