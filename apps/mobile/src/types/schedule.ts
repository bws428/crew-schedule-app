/** Types matching the server's shared types */

export interface FlightLeg {
  dayOfWeek: string;
  dayOfMonth: number;
  isDeadhead: boolean;
  positionCode: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureLocal: string;
  arrivalLocal: string;
  blockTime: string;
  groundTime: string;
}

export interface Layover {
  airport: string;
  restTime: string;
  hotelName: string;
  hotelPhone: string;
  dutyEndLocal: string;
  reportLocal: string;
}

export interface DutyPeriod {
  legs: FlightLeg[];
  totalBlock: string;
  totalDeadhead: string;
  totalCredit: string;
  totalDutyFdp: string;
  layover: Layover | null;
}

export interface CrewMember {
  position: string;
  employeeNumber: string;
  name: string;
}

export interface Trip {
  tripNumber: string;
  dateStr: string;
  date: string;
  frequency: string;
  baseReportTime: string;
  operatingDates: string;
  base: string;
  equipment: string;
  crewComposition: string;
  exceptions: string;
  dutyPeriods: DutyPeriod[];
  tafb: string;
  tripRig: string;
  totals: {
    block: string;
    deadhead: string;
    credit: string;
    dutyFdp: string;
  };
  crew: CrewMember[];
}

export interface Activity {
  type: string;
  dateStr: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  credit: string;
}

export interface CalendarDay {
  dayOfWeek: string;
  dayOfMonth: number;
  activity: string;
  layoverAirport: string;
  isWeekend: boolean;
}

export interface ScheduleSummary {
  block: number;
  credit: number;
  ytd: number;
  daysOff: number;
}

export type ScheduleItem =
  | { type: 'trip'; data: Trip }
  | { type: 'activity'; data: Activity };

export interface MonthlySchedule {
  month: string;
  year: number;
  crewMemberName: string;
  employeeNumber: string;
  lastUpdated: string;
  calendar: CalendarDay[];
  items: ScheduleItem[];
  summary: ScheduleSummary;
}
