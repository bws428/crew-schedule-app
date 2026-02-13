/** Centralized theme tokens — designed for future light/dark toggle */

export interface Theme {
  colors: {
    background: string;
    backgroundSecondary: string;
    backgroundExpanded: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentLight: string;
    border: string;
    error: string;
    white: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
}

export const LightTheme: Theme = {
  colors: {
    background: '#FFFFFF',
    backgroundSecondary: '#F5F7FA',
    backgroundExpanded: '#F9FAFB',
    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    accent: '#009688',
    accentLight: '#E0F2F1',
    border: '#E5E7EB',
    error: '#E74C3C',
    white: '#FFFFFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 16,
    pill: 20,
  },
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 28,
  },
};

// Currently hardcoded to light — swap to context-based for theme toggle
export const theme = LightTheme;

/** Activity color pairs: text color + light background for pill badges */
export interface ActivityStyle {
  text: string;
  bg: string;
}

const ACTIVITY_STYLE_MAP: Record<string, ActivityStyle> = {
  trip: { text: '#009688', bg: '#E0F2F1' },
  SIC: { text: '#E07B39', bg: '#FFF3E0' },
  SIM: { text: '#9B59B6', bg: '#F3E5F5' },
  REO: { text: '#27AE60', bg: '#E8F5E9' },
  VAC: { text: '#16A085', bg: '#E0F2F1' },
  TRN: { text: '#F39C12', bg: '#FFF8E1' },
  GRD: { text: '#95A5A6', bg: '#F5F5F5' },
  DPE: { text: '#3498DB', bg: '#E3F2FD' },
  OE: { text: '#8E44AD', bg: '#F3E5F5' },
  IOE: { text: '#8E44AD', bg: '#F3E5F5' },
  RES: { text: '#2980B9', bg: '#E3F2FD' },
};

const DEFAULT_STYLE: ActivityStyle = { text: '#009688', bg: '#E0F2F1' };

/** Get the badge color pair for a given activity code or trip number */
export function getActivityStyle(activity: string): ActivityStyle {
  if (!activity) return DEFAULT_STYLE;
  if (activity.startsWith('O')) return ACTIVITY_STYLE_MAP.trip;
  return ACTIVITY_STYLE_MAP[activity] || DEFAULT_STYLE;
}

/** Human-readable labels for FLICA activity codes (Spirit Airlines) */
export const ACTIVITY_LABELS: Record<string, string> = {
  // Common codes from FLICA/CrewTrac code list
  SIC: 'Sick Absence',
  SIM: 'Recurrent Sim',
  SIO: 'Recurrent Sim (Day Off)',
  REO: 'Recurrent Ground (MCO)',
  REF: 'Recurrent Ground (FLL)',
  REL: 'Recurrent Ground (LAS)',
  REW: 'Recurrent Ground (DFW)',
  ROF: 'Recurrent Ground (FLL, Day Off)',
  ROL: 'Recurrent Ground (LAS, Day Off)',
  ROW: 'Recurrent Ground (DFW, Day Off)',
  VAC: 'Vacation',
  VFL: 'Floating Vacation',
  VFO: 'Floating Vacation (OT)',
  TRN: 'Ground Training (Instructor)',
  TRG: 'Training',
  GRD: 'Ground School',
  IOE: 'Initial OE',
  COE: 'Upgrade OE',
  CPT: 'CPT Training',
  CUT: 'Captain Upgrade Training',
  FTD: 'FTD Training',
  IND: 'Indoc',
  ISM: 'Initial Sim Training',
  S3T: 'S3 Special Training',
  DPE: 'Designated Pilot Examiner',
  ALB: 'ALPA Business',
  ALD: 'ALPA (On Duty)',
  ALP: 'ALPA Business',
  BRV: 'Bereavement Leave',
  FML: 'Family Medical Leave',
  LOA: 'Leave of Absence',
  MED: 'Medical Leave',
  MIL: 'Military Leave',
  JUR: 'Jury Duty',
  PDY: 'Personal Day',
  RLS: 'Released from Duty',
  OFC: 'Office Duty',
  DRG: 'Drug Testing',
  ALC: 'Alcohol Testing',
  CKR: 'Check Ride',
  FTG: 'Fatigue',
  GDO: 'Guaranteed Day Off',
  PIV: 'Paid Inviolate Day',
  LCR: 'Long Call Reserve',
  FLR: 'First Long Reserve',
  NAV: 'Not Available',
  RRD: 'Reserve Day',
  OTA: 'Open Time Add',
  OTD: 'Open Time Drop',
  TTA: 'Trip Trade Add',
  TTD: 'Trip Trade Drop',
  ADV: 'Notified of Change',
  DSP: 'Displaced for Training',
};
