import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity } from '../types/schedule';
import { theme, ACTIVITY_LABELS, getActivityStyle } from '../theme';

interface Props {
  activity: Activity;
}

export function ActivityDetail({ activity }: Props) {
  const label = ACTIVITY_LABELS[activity.type] || activity.type;
  const style = getActivityStyle(activity.type);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: style.text }]}>{label}</Text>

      <View style={styles.timesRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>Start</Text>
          <Text style={styles.timeValue}>{activity.startTime || '--:--'}</Text>
          <Text style={styles.dateValue}>{activity.startDate}</Text>
        </View>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>{'\u2192'}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>End</Text>
          <Text style={styles.timeValue}>{activity.endTime || '--:--'}</Text>
          <Text style={styles.dateValue}>{activity.endDate}</Text>
        </View>
        {activity.credit ? (
          <View style={styles.creditBlock}>
            <Text style={styles.creditLabel}>Credit</Text>
            <Text style={styles.creditValue}>{formatCredit(activity.credit)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatCredit(credit: string): string {
  if (!credit || credit.length < 3) return credit;
  const h = parseInt(credit.substring(0, credit.length - 2), 10);
  const m = credit.substring(credit.length - 2);
  return `${h}:${m}`;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: 8,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timeBlock: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  timeValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  dateValue: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  arrow: {
    marginTop: 10,
  },
  arrowText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.lg,
  },
  creditBlock: {
    alignItems: 'center',
    marginLeft: 'auto',
  },
  creditLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  creditValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.accent,
    marginTop: 2,
  },
});
