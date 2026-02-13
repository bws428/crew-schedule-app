import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScheduleSummary } from '../types/schedule';
import { theme } from '../theme';

interface Props {
  month: string;
  year: number;
  crewMemberName: string;
  employeeNumber: string;
  summary: ScheduleSummary;
}

export function ScheduleHeader({ month, year, crewMemberName, employeeNumber, summary }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      <Text style={styles.monthYear}>
        {month} {year}
      </Text>
      <Text style={styles.crewInfo}>
        {crewMemberName} <Text style={styles.empNumber}>#{employeeNumber}</Text>
      </Text>
      <View style={styles.statsRow}>
        <StatPill label="Block" value={formatTime(summary.block)} />
        <StatPill label="Credit" value={formatTime(summary.credit)} />
        <StatPill label="YTD" value={formatTime(summary.ytd)} />
        <StatPill label="Off" value={String(summary.daysOff)} />
      </View>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    paddingBottom: 8,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  monthYear: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: 0.3,
  },
  crewInfo: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  empNumber: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentLight,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.pill,
    gap: 5,
  },
  pillLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  pillValue: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.accent,
  },
});
