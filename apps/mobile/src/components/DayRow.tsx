import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ScheduleItem } from '../types/schedule';
import { theme, getActivityStyle, ACTIVITY_LABELS } from '../theme';
import { TripDetail } from './TripDetail';
import { ActivityDetail } from './ActivityDetail';

export interface DayViewModel {
  dayOfMonth: number;
  dayOfWeek: string;
  isWeekend: boolean;
  type: 'trip' | 'activity' | 'off';
  activity: string;
  layoverAirport: string;
  reportTime: string;
  item: ScheduleItem | null;
}

interface Props {
  day: DayViewModel;
  isExpanded: boolean;
  onPress: () => void;
}

export const DayRow = memo(function DayRow({ day, isExpanded, onPress }: Props) {
  if (day.type === 'off') {
    return <OffDayRow day={day} />;
  }

  const activityStyle = getActivityStyle(day.activity);
  const isContinuation = day.type === 'trip' && !day.activity;
  const badgeText = isContinuation
    ? day.item?.type === 'trip'
      ? day.item.data.tripNumber
      : ''
    : day.activity;
  const activityLabel =
    day.type === 'activity' ? ACTIVITY_LABELS[day.activity] || '' : '';

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          day.type === 'trip' ? styles.tripRow : styles.activityRow,
          pressed && styles.rowPressed,
          isExpanded && styles.rowExpanded,
        ]}
      >
        {/* Date column */}
        <View style={styles.dateColumn}>
          <Text style={styles.dayNumber}>{day.dayOfMonth}</Text>
          <Text style={styles.dayOfWeek}>{day.dayOfWeek}</Text>
        </View>

        {/* Center: badge + info */}
        <View style={styles.centerContent}>
          {badgeText ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: isContinuation ? 'transparent' : activityStyle.bg },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: activityStyle.text,
                    opacity: isContinuation ? 0.5 : 1,
                  },
                ]}
              >
                {badgeText}
              </Text>
            </View>
          ) : null}
          {activityLabel ? (
            <Text style={styles.activityLabel} numberOfLines={1}>
              {activityLabel}
            </Text>
          ) : null}
          {day.layoverAirport ? (
            <Text style={styles.layoverText}>{day.layoverAirport}</Text>
          ) : null}
        </View>

        {/* Right: report time + chevron */}
        <View style={styles.rightContent}>
          {day.reportTime ? (
            <Text style={styles.reportTime}>{day.reportTime}</Text>
          ) : null}
          <Text style={[styles.chevron, isExpanded && styles.chevronExpanded]}>
            {'\u203A'}
          </Text>
        </View>
      </Pressable>

      {/* Expanded detail */}
      {isExpanded && day.item && (
        <View style={styles.expandedContainer}>
          {day.item.type === 'trip' ? (
            <TripDetail trip={day.item.data} />
          ) : (
            <ActivityDetail activity={day.item.data} />
          )}
        </View>
      )}
    </View>
  );
});

function OffDayRow({ day }: { day: DayViewModel }) {
  return (
    <View style={styles.offRow}>
      <Text style={styles.offDayNumber}>{day.dayOfMonth}</Text>
      <Text style={styles.offDayOfWeek}>{day.dayOfWeek}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Active rows (trip + activity)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tripRow: {
    minHeight: 52,
    paddingVertical: theme.spacing.sm,
  },
  activityRow: {
    minHeight: 48,
    paddingVertical: theme.spacing.sm,
  },
  rowPressed: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  rowExpanded: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 0,
  },

  // Date column
  dateColumn: {
    width: 44,
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  dayOfWeek: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 1,
  },

  // Center content
  centerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: theme.spacing.md,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.pill,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  activityLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  layoverText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  // Right content
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: theme.spacing.sm,
  },
  reportTime: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    fontSize: 18,
    color: theme.colors.textMuted,
    transform: [{ rotate: '0deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },

  // Expanded detail
  expandedContainer: {
    backgroundColor: theme.colors.backgroundExpanded,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    marginLeft: 44 + theme.spacing.md, // Align with center content
  },

  // Off day row
  offRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  offDayNumber: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    width: 44,
    textAlign: 'center',
  },
  offDayOfWeek: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.md,
    textTransform: 'uppercase',
  },
});
