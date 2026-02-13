import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  month: number;
  year: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function MonthNavigator({ month, year, onPrevMonth, onNextMonth }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrevMonth} style={styles.arrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
        <Text style={styles.arrowText}>{'<'}</Text>
      </TouchableOpacity>
      <Text style={styles.label}>{MONTH_NAMES[month]} {year}</Text>
      <TouchableOpacity onPress={onNextMonth} style={styles.arrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
        <Text style={styles.arrowText}>{'>'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.lg,
  },
  arrow: {
    padding: theme.spacing.xs,
  },
  arrowText: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  label: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    minWidth: 160,
    textAlign: 'center',
  },
});
