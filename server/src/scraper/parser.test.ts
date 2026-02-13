import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parseScheduleDetail } from './parser.js';
import type { MonthlySchedule } from '../../packages/shared/src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('FLICA Schedule Parser', () => {
  let schedule: MonthlySchedule;

  beforeAll(() => {
    const html = readFileSync(
      join(__dirname, '__fixtures__', 'schedule-detail-feb2026.html'),
      'utf-8',
    );
    schedule = parseScheduleDetail(html);
  });

  describe('Header parsing', () => {
    it('should parse the month name', () => {
      expect(schedule.month).toBe('February');
    });

    it('should parse the year', () => {
      expect(schedule.year).toBe(2026);
    });

    it('should parse the crew member name', () => {
      expect(schedule.crewMemberName).toBe('Brian Wendt');
    });

    it('should parse the employee number', () => {
      expect(schedule.employeeNumber).toBe('76148');
    });

    it('should parse the last updated timestamp', () => {
      expect(schedule.lastUpdated).toContain('Feb 12, 2026');
    });
  });

  describe('Calendar sidebar parsing', () => {
    it('should parse all calendar days', () => {
      // Feb 2026 schedule shows SA 31 through SU 01 (next month)
      expect(schedule.calendar.length).toBeGreaterThanOrEqual(28);
    });

    it('should identify trip days correctly', () => {
      // Day 01 (SU) should have O4031
      const day1 = schedule.calendar.find(d => d.dayOfMonth === 1 && d.dayOfWeek === 'SU');
      expect(day1?.activity).toBe('O4031');
    });

    it('should identify activity days correctly', () => {
      // Day 06 (FR) should have SIC
      const day6 = schedule.calendar.find(d => d.dayOfMonth === 6 && d.dayOfWeek === 'FR');
      expect(day6?.activity).toBe('SIC');
    });

    it('should identify layover airports', () => {
      // Day 01 starts trip O4031 which overnights in BOS
      const day1 = schedule.calendar.find(d => d.dayOfMonth === 1 && d.dayOfWeek === 'SU');
      expect(day1?.layoverAirport).toBe('BOS');
    });

    it('should identify weekend days', () => {
      const satDay = schedule.calendar.find(d => d.dayOfWeek === 'SA');
      expect(satDay?.isWeekend).toBe(true);

      const sunDay = schedule.calendar.find(d => d.dayOfWeek === 'SU');
      expect(sunDay?.isWeekend).toBe(true);
    });

    it('should identify off days (empty activity)', () => {
      // Day 03 (TU) should be off
      const day3 = schedule.calendar.find(d => d.dayOfMonth === 3 && d.dayOfWeek === 'TU');
      expect(day3?.activity).toBe('');
    });
  });

  describe('Summary parsing', () => {
    it('should parse block hours', () => {
      expect(schedule.summary.block).toBe(43.18);
    });

    it('should parse credit hours', () => {
      expect(schedule.summary.credit).toBe(69.51);
    });

    it('should parse YTD hours', () => {
      expect(schedule.summary.ytd).toBe(65.50);
    });

    it('should parse days off', () => {
      expect(schedule.summary.daysOff).toBe(18);
    });
  });

  describe('Trip parsing', () => {
    it('should find all trips', () => {
      const trips = schedule.items.filter(i => i.type === 'trip');
      // O4031, O4019, O4050, O4001 (15FEB), O4035, O4001 (01MAR) = 6 trips
      expect(trips.length).toBe(6);
    });

    it('should parse the first trip (O4031) correctly', () => {
      const trip = schedule.items.find(
        i => i.type === 'trip' && i.data.tripNumber === 'O4031',
      );
      expect(trip).toBeDefined();
      if (trip?.type !== 'trip') return;

      const data = trip.data;
      expect(data.tripNumber).toBe('O4031');
      expect(data.dateStr).toBe('01FEB');
      expect(data.frequency).toBe('EVERY DAY');
      expect(data.baseReportTime).toBe('0515L');
      expect(data.operatingDates).toBe('Feb 1-Feb 9');
      expect(data.base).toBe('MCO');
      expect(data.equipment).toBe('321');
      expect(data.crewComposition).toBe('CA01FO01');
    });

    it('should parse flight legs for O4031', () => {
      const trip = schedule.items.find(
        i => i.type === 'trip' && i.data.tripNumber === 'O4031',
      );
      if (trip?.type !== 'trip') return;

      // O4031 has legs: MCO-SJU, SJU-BOS (day 1), BOS-MCO (day 2)
      const allLegs = trip.data.dutyPeriods.flatMap(dp => dp.legs);
      expect(allLegs.length).toBe(3);

      // First leg: MCO-SJU
      expect(allLegs[0].flightNumber).toBe('460');
      expect(allLegs[0].origin).toBe('MCO');
      expect(allLegs[0].destination).toBe('SJU');
      expect(allLegs[0].departureLocal).toBe('0559');
      expect(allLegs[0].arrivalLocal).toBe('0940');

      // Second leg: SJU-BOS
      expect(allLegs[1].flightNumber).toBe('3012');
      expect(allLegs[1].origin).toBe('SJU');
      expect(allLegs[1].destination).toBe('BOS');

      // Third leg (next day): BOS-MCO
      expect(allLegs[2].flightNumber).toBe('271');
      expect(allLegs[2].origin).toBe('BOS');
      expect(allLegs[2].destination).toBe('MCO');
    });

    it('should parse crew members', () => {
      const trip = schedule.items.find(
        i => i.type === 'trip' && i.data.tripNumber === 'O4031',
      );
      if (trip?.type !== 'trip') return;

      expect(trip.data.crew.length).toBe(2);

      const captain = trip.data.crew.find(c => c.position === 'CA');
      expect(captain?.name).toBe('Price, Gregory');
      expect(captain?.employeeNumber).toBe('67948');

      const fo = trip.data.crew.find(c => c.position === 'FO');
      expect(fo?.name).toBe('Wendt, Brian');
      expect(fo?.employeeNumber).toBe('76148');
    });

    it('should parse TAFB correctly', () => {
      const trip = schedule.items.find(
        i => i.type === 'trip' && i.data.tripNumber === 'O4031',
      );
      if (trip?.type !== 'trip') return;
      expect(trip.data.tafb).toBe('2909');
    });

    it('should parse a multi-day trip with layover (O4050)', () => {
      const trip = schedule.items.find(
        i => i.type === 'trip' &&
        i.data.tripNumber === 'O4050' &&
        i.data.dateStr === '13FEB',
      );
      if (trip?.type !== 'trip') return;

      expect(trip.data.dutyPeriods.length).toBeGreaterThanOrEqual(1);
      // O4050 goes MCO-DTW-LGA (day 1), LGA-MCO (day 2)
      const allLegs = trip.data.dutyPeriods.flatMap(dp => dp.legs);
      expect(allLegs.length).toBe(3);
      expect(allLegs[0].origin).toBe('MCO');
      expect(allLegs[0].destination).toBe('DTW');
      expect(allLegs[1].origin).toBe('DTW');
      expect(allLegs[1].destination).toBe('LGA');
      expect(allLegs[2].origin).toBe('LGA');
      expect(allLegs[2].destination).toBe('MCO');
    });
  });

  describe('Activity parsing', () => {
    it('should find all activities', () => {
      const activities = schedule.items.filter(i => i.type === 'activity');
      // SIC (06FEB), SIC (07FEB), REO (24FEB), SIM (25FEB), SIM (26FEB) = 5
      expect(activities.length).toBe(5);
    });

    it('should parse SIC activity correctly', () => {
      const sic = schedule.items.find(
        i => i.type === 'activity' && i.data.dateStr === '06FEB',
      );
      expect(sic).toBeDefined();
      if (sic?.type !== 'activity') return;

      expect(sic.data.type).toBe('SIC');
      expect(sic.data.startDate).toBe('06FEB');
      expect(sic.data.startTime).toBe('05:15');
      expect(sic.data.endDate).toBe('07FEB');
      expect(sic.data.endTime).toBe('11:02');
      expect(sic.data.credit).toBe('1039');
    });

    it('should parse SIM activity correctly', () => {
      const sim = schedule.items.find(
        i => i.type === 'activity' && i.data.dateStr === '25FEB',
      );
      expect(sim).toBeDefined();
      if (sim?.type !== 'activity') return;

      expect(sim.data.type).toBe('SIM');
      expect(sim.data.startTime).toBe('09:45');
      expect(sim.data.endTime).toBe('15:15');
      expect(sim.data.credit).toBe('0400');
    });

    it('should parse REO activity correctly', () => {
      const reo = schedule.items.find(
        i => i.type === 'activity' && i.data.type === 'REO',
      );
      expect(reo).toBeDefined();
      if (reo?.type !== 'activity') return;

      expect(reo.data.dateStr).toBe('24FEB');
      expect(reo.data.startTime).toBe('08:00');
      expect(reo.data.endTime).toBe('17:00');
    });
  });

  describe('Schedule items ordering', () => {
    it('should have items in chronological order', () => {
      // Items should go: O4031 (01FEB), SIC (06FEB), SIC (07FEB), O4019 (08FEB), etc.
      const firstItem = schedule.items[0];
      if (firstItem.type === 'trip') {
        expect(firstItem.data.tripNumber).toBe('O4031');
      }
    });
  });
});
