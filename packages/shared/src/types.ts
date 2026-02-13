/**
 * Shared types for the Crew Schedule App
 * These types represent the parsed data from FLICA schedule pages.
 */

/** A single flight leg within a trip */
export interface FlightLeg {
  /** Day of week abbreviation (SU, MO, TU, etc.) */
  dayOfWeek: string;
  /** Day of month */
  dayOfMonth: number;
  /** Whether this is a deadhead leg */
  isDeadhead: boolean;
  /** Position code (e.g., "*" for captain leg) */
  positionCode: string;
  /** Flight number */
  flightNumber: string;
  /** Origin airport code */
  origin: string;
  /** Destination airport code */
  destination: string;
  /** Departure time (local, HHMM format) */
  departureLocal: string;
  /** Arrival time (local, HHMM format) */
  arrivalLocal: string;
  /** Block time (HHMM format) */
  blockTime: string;
  /** Ground time / guaranteed time (HHMM format) */
  groundTime: string;
}

/** Layover information between duty periods */
export interface Layover {
  /** Airport code */
  airport: string;
  /** Rest time (HHMM format) */
  restTime: string;
  /** Hotel name */
  hotelName: string;
  /** Hotel phone number */
  hotelPhone: string;
  /** Duty end time */
  dutyEndLocal: string;
  /** Report time for next duty */
  reportLocal: string;
}

/** A duty period (one day's flying within a trip) */
export interface DutyPeriod {
  /** Flight legs in this duty period */
  legs: FlightLeg[];
  /** Total block time for the duty period (HHMM) */
  totalBlock: string;
  /** Total deadhead time (HHMM) */
  totalDeadhead: string;
  /** Total credit time (HHMM) */
  totalCredit: string;
  /** Total duty/FDP time (e.g., "0942/0912") */
  totalDutyFdp: string;
  /** Layover info (null if last duty period or turn) */
  layover: Layover | null;
}

/** A crew member assigned to a trip */
export interface CrewMember {
  /** Position (CA = Captain, FO = First Officer) */
  position: string;
  /** Employee number */
  employeeNumber: string;
  /** Full name */
  name: string;
}

/** A complete trip/pairing */
export interface Trip {
  /** Trip/pairing number (e.g., "O4031") */
  tripNumber: string;
  /** Date string for this instance (e.g., "01FEB") */
  dateStr: string;
  /** Full date for this instance */
  date: string;
  /** Day of week pattern (e.g., "EVERY DAY", "EXCEPT SAT") */
  frequency: string;
  /** Base report time (e.g., "0515L") */
  baseReportTime: string;
  /** Operating dates description (e.g., "Feb 1-Feb 9") */
  operatingDates: string;
  /** Base airport code */
  base: string;
  /** Equipment type (e.g., "321" for A321) */
  equipment: string;
  /** Crew composition (e.g., "CA01FO01") */
  crewComposition: string;
  /** Exception dates */
  exceptions: string;
  /** Duty periods */
  dutyPeriods: DutyPeriod[];
  /** Time Away From Base (HHMM) */
  tafb: string;
  /** Trip rig time if applicable */
  tripRig: string;
  /** Totals for the trip */
  totals: {
    block: string;
    deadhead: string;
    credit: string;
    dutyFdp: string;
  };
  /** Crew members */
  crew: CrewMember[];
}

/** A non-flying activity (SIC, SIM, REO, etc.) */
export interface Activity {
  /** Activity type (SIC, SIM, REO, VAC, etc.) */
  type: string;
  /** Date string (e.g., "06FEB") */
  dateStr: string;
  /** Start date */
  startDate: string;
  /** Start time (HH:MM) */
  startTime: string;
  /** End date */
  endDate: string;
  /** End time (HH:MM) */
  endTime: string;
  /** Credit hours (HHMM format) */
  credit: string;
}

/** A single day entry in the calendar sidebar */
export interface CalendarDay {
  /** Day of week abbreviation */
  dayOfWeek: string;
  /** Day of month */
  dayOfMonth: number;
  /** Trip number (if flying), activity code (SIC, SIM, etc.), or empty */
  activity: string;
  /** Layover airport code (if away from base) */
  layoverAirport: string;
  /** Whether this is a weekend day */
  isWeekend: boolean;
}

/** Monthly schedule summary totals */
export interface ScheduleSummary {
  /** Total block hours for the month */
  block: number;
  /** Total credit hours for the month */
  credit: number;
  /** Year-to-date hours */
  ytd: number;
  /** Number of days off */
  daysOff: number;
}

/** A schedule item is either a Trip or an Activity */
export type ScheduleItem =
  | { type: 'trip'; data: Trip }
  | { type: 'activity'; data: Activity };

/** The complete parsed schedule for a month */
export interface MonthlySchedule {
  /** Month name */
  month: string;
  /** Year */
  year: number;
  /** Crew member name */
  crewMemberName: string;
  /** Crew member employee number */
  employeeNumber: string;
  /** Last updated timestamp */
  lastUpdated: string;
  /** Calendar sidebar data (each day of the month) */
  calendar: CalendarDay[];
  /** Schedule items (trips and activities) in order */
  items: ScheduleItem[];
  /** Monthly summary totals */
  summary: ScheduleSummary;
}
