/**
 * FLICA Schedule Detail HTML Parser
 *
 * Parses the HTML from /full/scheduledetail.cgi into structured data.
 * This parser handles the Spirit Airlines FLICA format and can be
 * extended with airline-specific adapters for other carriers.
 */

import * as cheerio from 'cheerio';
import type {
  MonthlySchedule,
  ScheduleItem,
  Trip,
  Activity,
  CalendarDay,
  ScheduleSummary,
  FlightLeg,
  DutyPeriod,
  Layover,
  CrewMember,
} from '../../packages/shared/src/types.js';

// Month abbreviation to number mapping
const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Parse a FLICA schedule detail HTML page into structured data.
 */
export function parseScheduleDetail(html: string): MonthlySchedule {
  const $ = cheerio.load(html);

  // Parse header info
  const header = parseHeader($);

  // Parse the calendar sidebar (left panel - table2)
  const calendar = parseCalendar($);

  // Parse schedule items (right panel - table4)
  const items = parseScheduleItems($, header.year, header.monthNumber);

  // Parse monthly summary totals
  const summary = parseSummary($);

  return {
    month: header.month,
    year: header.year,
    crewMemberName: header.crewMemberName,
    employeeNumber: header.employeeNumber,
    lastUpdated: header.lastUpdated,
    calendar,
    items,
    summary,
  };
}

interface HeaderInfo {
  month: string;
  monthNumber: number;
  year: number;
  crewMemberName: string;
  employeeNumber: string;
  lastUpdated: string;
}

function parseHeader($: cheerio.CheerioAPI): HeaderInfo {
  const h3Text = $('h3').first().text();

  // Extract month from "February Schedule"
  const monthMatch = h3Text.match(/(\w+)\s+Schedule/);
  const monthName = monthMatch ? monthMatch[1] : '';

  // Map month name to number
  const monthNumber = MONTH_NAMES.indexOf(monthName);

  // Extract crew member name and employee number
  // Format: "Brian Wendt (76148)"
  const nameMatch = h3Text.match(/Schedule\s+([\w\s,]+?)\s*\((\d+)\)/);
  const crewMemberName = nameMatch ? nameMatch[1].trim() : '';
  const employeeNumber = nameMatch ? nameMatch[2] : '';

  // Extract last updated and year from it
  const updatedMatch = h3Text.match(/Last Updated\s+(.+?)$/m);
  const lastUpdated = updatedMatch ? updatedMatch[1].trim() : '';

  // Extract year from the last updated date
  const yearMatch = lastUpdated.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  return {
    month: monthName,
    monthNumber,
    year,
    crewMemberName,
    employeeNumber,
    lastUpdated,
  };
}

function parseCalendar($: cheerio.CheerioAPI): CalendarDay[] {
  const calendar: CalendarDay[] = [];
  const table2 = $('table#table2, table[name="table2"]');

  table2.find('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;

    const dayOfWeek = $(cells[0]).text().trim();
    const dayOfMonthStr = $(cells[1]).text().trim();
    const activity = $(cells[2]).text().trim();
    const layoverAirport = $(cells[3]).text().trim();

    // Skip summary rows (Block, Credit, YTD, Days Off)
    if (!dayOfWeek || !dayOfMonthStr || isNaN(parseInt(dayOfMonthStr, 10))) return;

    const dayOfMonth = parseInt(dayOfMonthStr, 10);
    const isWeekend = $(row).attr('bgcolor')?.toLowerCase() === 'lightsteelblue' || false;

    calendar.push({
      dayOfWeek,
      dayOfMonth,
      activity,
      layoverAirport,
      isWeekend,
    });
  });

  return calendar;
}

function parseScheduleItems(
  $: cheerio.CheerioAPI,
  year: number,
  monthNumber: number,
): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  // Get the right panel content (table4)
  const table4 = $('table[name="table4"]');
  if (!table4.length) return items;

  // Find all content tables within table4's main cell
  // Cheerio auto-inserts <tbody>, so handle both selectors
  const mainCell = table4.find('> tbody > tr > td, > tr > td').first();

  // Strategy: iterate through sibling tables in the right panel.
  // Trip headers have a td with style containing "color: #0000ff" and format "O4031 : 01FEB"
  // Activity headers have a font tag with format "SIC : 06FEB"
  // Header tables (with <hr>) are separators between items.

  const allTables = mainCell.children('table');
  let i = 0;

  while (i < allTables.length) {
    const table = $(allTables[i]);

    // Check if this is a header separator table (contains <hr>)
    if (table.attr('name') === 'headertable' || table.find('hr').length > 0) {
      i++;
      continue;
    }

    // Check if this is a trip table (has blue header with trip number pattern)
    const tripHeaderTd = table.find('td').filter((_, el) => {
      const style = $(el).attr('style') || '';
      const text = $(el).text().trim();
      return style.includes('color: #0000ff') && /^O\d+\s*:\s*\d{2}[A-Z]{3}/.test(text);
    });

    if (tripHeaderTd.length > 0) {
      const trip = parseTrip($, table, year, monthNumber);
      if (trip) {
        items.push({ type: 'trip', data: trip });
      }
      i++;
      continue;
    }

    // Check if this is an activity table (SIC, SIM, REO, VAC, etc.)
    // Match any 2-4 uppercase letter code followed by ": DDMMM" date pattern
    const activityHeader = table.find('font').filter((_, el) => {
      const text = $(el).text().trim();
      return /^[A-Z]{2,4}\s*:\s*\d{2}[A-Z]{3}/.test(text);
    });

    if (activityHeader.length > 0) {
      const activity = parseActivity($, table);
      if (activity) {
        items.push({ type: 'activity', data: activity });
      }
      i++;
      continue;
    }

    i++;
  }

  return items;
}

function parseTrip(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<cheerio.Element>,
  year: number,
  monthNumber: number,
): Trip | null {
  const rows = table.find('> tr, > tbody > tr');
  if (rows.length < 2) return null;

  // First row: trip number, frequency, report time, operating dates
  const headerCells = $(rows[0]).find('td');
  const tripHeaderText = $(headerCells[0]).text().trim();
  const tripMatch = tripHeaderText.match(/^(O\d+)\s*:\s*(\d{2}[A-Z]{3})/);
  if (!tripMatch) return null;

  const tripNumber = tripMatch[1];
  const dateStr = tripMatch[2];
  const frequency = $(headerCells[1]).text().trim();
  const reportTimeText = $(headerCells[2]).text().trim();
  const reportTimeMatch = reportTimeText.match(/BSE REPT:\s*(\d{4}L?)/);
  const baseReportTime = reportTimeMatch ? reportTimeMatch[1] : '';

  const operatesText = $(headerCells[3]).text().trim();
  const operatesMatch = operatesText.match(/Operates:\s*(.+)/);
  const operatingDates = operatesMatch ? operatesMatch[1] : '';

  // Second row: base/equip, crew composition, exceptions
  const detailCells = $(rows[1]).find('td');
  const baseEquipText = $(detailCells[0]).text().trim();
  const baseEquipMatch = baseEquipText.match(/Base\/Equip:\s*(\w+)\/(\w+)/);
  const base = baseEquipMatch ? baseEquipMatch[1] : '';
  const equipment = baseEquipMatch ? baseEquipMatch[2] : '';
  const crewComposition = $(detailCells[1]).text().trim();

  const exceptionsText = detailCells.length > 2
    ? $(detailCells[2]).text().trim()
    : '';
  const exceptions = exceptionsText.replace(/^EXCEPT ON\s*/i, '');

  // Parse duty periods from the inner flight table
  const dutyPeriods = parseDutyPeriods($, table);

  // Extract TAFB and trip rig
  let tafb = '';
  let tripRig = '';
  table.find('strong').each((_, el) => {
    const text = $(el).text().trim();
    const tafbMatch = text.match(/T\.A\.F\.B\.:\s*(\d+)/);
    if (tafbMatch) tafb = tafbMatch[1];
    const rigMatch = text.match(/TRIP RIG:\s*(\d+)/);
    if (rigMatch) tripRig = rigMatch[1];
  });

  // Parse totals from the bold row
  const totals = parseTripTotals($, table);

  // Parse crew
  const crew = parseCrew($, table);

  // Build date string
  const dayNum = dateStr.substring(0, 2);
  const monthAbbr = dateStr.substring(2);
  const dateMonthNum = MONTH_MAP[monthAbbr] || monthNumber;
  const dateYear = dateMonthNum < monthNumber ? year + 1 : year;
  const date = `${dateYear}-${String(dateMonthNum).padStart(2, '0')}-${dayNum}`;

  return {
    tripNumber,
    dateStr,
    date,
    frequency,
    baseReportTime,
    operatingDates,
    base,
    equipment,
    crewComposition,
    exceptions,
    dutyPeriods,
    tafb,
    tripRig,
    totals,
    crew,
  };
}

function parseDutyPeriods(
  $: cheerio.CheerioAPI,
  tripTable: cheerio.Cheerio<cheerio.Element>,
): DutyPeriod[] {
  const dutyPeriods: DutyPeriod[] = [];

  // Find the inner flight table (has class="main" header row)
  const flightTable = tripTable.find('table').filter((_, el) => {
    return $(el).find('tr.main').length > 0;
  }).first();

  if (!flightTable.length) return dutyPeriods;

  const flightRows = flightTable.find('tr');
  let currentLegs: FlightLeg[] = [];
  let currentLayover: Layover | null = null;
  let lastDayOfMonth = 0;
  let totalBlock = '';
  let totalDeadhead = '';
  let totalCredit = '';
  let totalDutyFdp = '';

  flightRows.each((_, row) => {
    const $row = $(row);

    // Skip header row
    if ($row.hasClass('main')) return;

    // Check for totals row
    if ($row.hasClass('bold')) {
      const cells = $row.find('td');
      cells.each((ci, cell) => {
        const text = $(cell).text().trim();
        if (text === 'Total:') {
          // Next cells have totals
          totalBlock = $(cells[ci + 1]).text().trim();
          totalDeadhead = $(cells[ci + 2]).text().trim();
          totalCredit = $(cells[ci + 4]).text().trim();
          totalDutyFdp = $(cells[ci + 5]).text().trim();
        }
      });
      return;
    }

    // Check for flight leg row (class="nowrap")
    if ($row.hasClass('nowrap')) {
      const cells = $row.find('td');
      if (cells.length < 10) return;

      const dayOfWeek = $(cells[0]).text().trim();
      const dayOfMonth = parseInt($(cells[1]).text().trim(), 10);
      const dhText = $(cells[2]).text().trim();
      const positionCode = $(cells[3]).text().trim();
      const flightNumber = $(cells[4]).text().trim();
      const route = $(cells[5]).text().trim();
      const departureLocal = $(cells[6]).text().trim();
      const arrivalLocal = $(cells[7]).text().trim();
      const blockTime = $(cells[8]).text().trim();
      const groundTime = $(cells[9]).text().trim();

      const [origin, destination] = route.split('-');

      // Detect new duty period (day changed and there was a layover)
      if (currentLegs.length > 0 && dayOfMonth !== lastDayOfMonth && currentLayover) {
        dutyPeriods.push({
          legs: currentLegs,
          totalBlock: '',
          totalDeadhead: '',
          totalCredit: '',
          totalDutyFdp: '',
          layover: currentLayover,
        });
        currentLegs = [];
        currentLayover = null;
      }

      lastDayOfMonth = dayOfMonth;

      currentLegs.push({
        dayOfWeek,
        dayOfMonth,
        isDeadhead: dhText !== '' && dhText !== '\u00a0',
        positionCode,
        flightNumber,
        origin: origin || '',
        destination: destination || '',
        departureLocal,
        arrivalLocal,
        blockTime,
        groundTime,
      });

      // Check for layover info in the last cell
      const lastCell = $(cells[cells.length - 1]);
      const layoverText = lastCell.text().trim();
      const layoverMatch = layoverText.match(/^([A-Z]{3})\s+(\d{4})$/);
      if (layoverMatch) {
        // Layover detected — hotel info will be in the next non-leg row
        currentLayover = {
          airport: layoverMatch[1],
          restTime: layoverMatch[2],
          hotelName: '',
          hotelPhone: '',
          dutyEndLocal: '',
          reportLocal: '',
        };
      }

      return;
    }

    // Check for D-END / layover detail row
    const rowText = $row.text().trim();
    const dendMatch = rowText.match(/D-END:\s*(\d{4}L?)/);
    if (dendMatch) {
      const reptMatch = rowText.match(/REPT:\s*(\d{4}L?)/);

      if (currentLayover) {
        currentLayover.dutyEndLocal = dendMatch[1];
        currentLayover.reportLocal = reptMatch ? reptMatch[1] : '';

        // Extract hotel info from the same row
        const cells = $row.find('td');
        cells.each((ci, cell) => {
          const text = $(cell).text().trim();
          // Hotel name usually spans multiple columns after the D-END info
          if (ci > 1 && text && !text.includes('D-END') && !text.includes('T.A.F.B.') && currentLayover) {
            if (!text.startsWith('(') && !currentLayover.hotelName) {
              currentLayover.hotelName = text;
            } else if (text.startsWith('(')) {
              currentLayover.hotelPhone = text;
            }
          }
        });
      }
      return;
    }
  });

  // Push the last duty period
  if (currentLegs.length > 0) {
    dutyPeriods.push({
      legs: currentLegs,
      totalBlock,
      totalDeadhead,
      totalCredit,
      totalDutyFdp,
      layover: null,
    });
  }

  return dutyPeriods;
}

function parseTripTotals(
  $: cheerio.CheerioAPI,
  tripTable: cheerio.Cheerio<cheerio.Element>,
): Trip['totals'] {
  let block = '';
  let deadhead = '';
  let credit = '';
  let dutyFdp = '';

  tripTable.find('tr.bold').last().find('td').each((ci, cell) => {
    const text = $(cell).text().trim();
    if (text === 'Total:') {
      const cells = tripTable.find('tr.bold').last().find('td');
      block = $(cells[ci + 1]).text().trim();
      deadhead = $(cells[ci + 2]).text().trim();
      credit = $(cells[ci + 4]).text().trim();
      dutyFdp = $(cells[ci + 5]).text().trim();
    }
  });

  return { block, deadhead, credit, dutyFdp };
}

function parseCrew(
  $: cheerio.CheerioAPI,
  tripTable: cheerio.Cheerio<cheerio.Element>,
): CrewMember[] {
  const crew: CrewMember[] = [];

  // Find the crew table (contains "Crew:" text)
  const crewTable = tripTable.find('table').filter((_, el) => {
    return $(el).find('strong').text().includes('Crew:');
  }).first();

  if (!crewTable.length) return crew;

  // Crew members are in rows with position (CA/FO), employee number, and name
  crewTable.find('tr').each((_, row) => {
    const cells = $(row).find('td');
    // Look for patterns like: [spacer] CA [emp#] [name] [spacer] FO [emp#] [name]
    for (let i = 0; i < cells.length - 2; i++) {
      const posText = $(cells[i]).text().trim();
      if (posText === 'CA' || posText === 'FO') {
        const empNum = $(cells[i + 1]).text().trim();
        const name = $(cells[i + 2]).text().trim();
        if (empNum && name) {
          crew.push({
            position: posText,
            employeeNumber: empNum,
            name,
          });
        }
      }
    }
  });

  return crew;
}

function parseActivity(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<cheerio.Element>,
): Activity | null {
  // Activity header: "SIC : 06FEB"
  const headerText = table.find('font').first().text().trim();
  const match = headerText.match(/^(\w+)\s*:\s*(\d{2}[A-Z]{3})/);
  if (!match) return null;

  const type = match[1];
  const dateStr = match[2];

  // Parse the data row (after the header row with column names)
  const rows = table.find('tr');
  let startDate = '';
  let startTime = '';
  let endDate = '';
  let endTime = '';
  let credit = '';

  // Find the data row (last row typically has the actual data)
  rows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 6) {
      const firstCellText = $(cells[0]).text().trim();
      // Skip the header row (contains "Activity") and the title row
      if (firstCellText === type) {
        startDate = $(cells[1]).text().trim();
        startTime = $(cells[2]).text().trim();
        endDate = $(cells[3]).text().trim();
        endTime = $(cells[4]).text().trim();
        credit = $(cells[5]).text().trim();
      }
    }
  });

  return {
    type,
    dateStr,
    startDate,
    startTime,
    endDate,
    endTime,
    credit,
  };
}

function parseSummary($: cheerio.CheerioAPI): ScheduleSummary {
  let block = 0;
  let credit = 0;
  let ytd = 0;
  let daysOff = 0;

  const table2 = $('table#table2, table[name="table2"]');

  table2.find('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 2) {
      const label = $(cells[0]).text().trim().toLowerCase();
      const valueText = $(cells[1]).text().trim();
      const value = parseFloat(valueText);

      if (label === 'block' && !isNaN(value)) block = value;
      else if (label === 'credit' && !isNaN(value)) credit = value;
      else if (label === 'ytd' && !isNaN(value)) ytd = value;
      else if (label.includes('days off') && !isNaN(value)) daysOff = value;
    }
  });

  return { block, credit, ytd, daysOff };
}
