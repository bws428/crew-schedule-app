import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
  TouchableOpacity,
} from 'react-native';
import { MonthlySchedule, ScheduleItem } from '../types/schedule';
import { SQLiteScheduleRepository } from '../db/scheduleRepository';
import { setLoggedIn } from '../services/flicaSession';
import { ScheduleHeader } from './ScheduleHeader';
import { DayRow, DayViewModel } from './DayRow';
import { FlicaWebView } from './FlicaWebView';
import { MonthNavigator } from './MonthNavigator';
import { theme } from '../theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const repo = new SQLiteScheduleRepository();

/**
 * Merge calendar days with schedule items to produce a flat list of day view models.
 */
function buildDayViewModels(schedule: MonthlySchedule): DayViewModel[] {
  const itemsByDay = new Map<number, ScheduleItem>();
  for (const item of schedule.items) {
    const dayStr = item.data.dateStr.substring(0, 2);
    const day = parseInt(dayStr, 10);
    if (!isNaN(day)) {
      itemsByDay.set(day, item);
    }
  }

  let lastTripItem: ScheduleItem | null = null;

  return schedule.calendar.map((calDay) => {
    const matchedItem = itemsByDay.get(calDay.dayOfMonth) || null;

    if (matchedItem?.type === 'trip') {
      lastTripItem = matchedItem;
    }

    let type: 'trip' | 'activity' | 'off';
    let reportTime = '';
    let item: ScheduleItem | null = matchedItem;

    if (calDay.activity.startsWith('O')) {
      type = 'trip';
      if (matchedItem?.type === 'trip') {
        reportTime = matchedItem.data.baseReportTime;
      }
    } else if (calDay.activity !== '') {
      type = 'activity';
      if (matchedItem?.type === 'activity') {
        reportTime = matchedItem.data.startTime;
      }
    } else if (calDay.layoverAirport !== '') {
      type = 'trip';
      item = lastTripItem;
      reportTime = '';
    } else {
      type = 'off';
    }

    return {
      dayOfMonth: calDay.dayOfMonth,
      dayOfWeek: calDay.dayOfWeek,
      isWeekend: calDay.isWeekend,
      type,
      activity: calDay.activity,
      layoverAirport: calDay.layoverAirport,
      reportTime,
      item,
    };
  });
}

function formatCacheAge(fetchedAt: string): string {
  const diff = Date.now() - new Date(fetchedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ScheduleScreen() {
  const [schedule, setSchedule] = useState<MonthlySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  // Month navigation
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  // WebView state
  const [webViewVisible, setWebViewVisible] = useState(false);

  // Load schedule from SQLite cache
  const loadFromCache = useCallback(
    async (month: number, year: number) => {
      try {
        const cached = await repo.getSchedule(month, year);
        if (cached) {
          setSchedule(cached);
          const fetchedAt = await repo.getFetchedAt(month, year);
          setCacheAge(fetchedAt ? formatCacheAge(fetchedAt) : null);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [],
  );

  // Initialize: load cache for current month
  useEffect(() => {
    (async () => {
      try {
        await loadFromCache(currentMonth, currentYear);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When month changes, load from cache
  useEffect(() => {
    if (loading) return;
    (async () => {
      setExpandedDay(null);
      const hasCached = await loadFromCache(currentMonth, currentYear);
      if (!hasCached) {
        setSchedule(null);
        setCacheAge(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshing(false);
    setWebViewVisible(true);
  }, []);

  const onDayPress = useCallback((day: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDay((prev) => (prev === day ? null : day));
  }, []);

  const onPrevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 1) {
        setCurrentYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }, []);

  const onNextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 12) {
        setCurrentYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }, []);

  // Called when WebView successfully parses the schedule
  const onScheduleLoaded = useCallback(
    async (data: MonthlySchedule) => {
      setSchedule(data);
      setWebViewVisible(false);
      setCacheAge('Just now');

      // Determine month number from the parsed schedule
      const monthNames = [
        '', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      const monthNum = monthNames.indexOf(data.month);
      const yearNum = data.year;

      if (monthNum > 0) {
        await repo.saveSchedule(monthNum, yearNum, data);
      }

      if (data.employeeNumber) {
        await setLoggedIn(data.employeeNumber);
      }
    },
    [],
  );

  const dayViewModels = useMemo(() => {
    if (!schedule) return [];
    return buildDayViewModels(schedule);
  }, [schedule]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  if (error && !schedule) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: DayViewModel }) => (
    <DayRow
      day={item}
      isExpanded={expandedDay === item.dayOfMonth}
      onPress={() => onDayPress(item.dayOfMonth)}
    />
  );

  const keyExtractor = (item: DayViewModel) => `day-${item.dayOfMonth}`;

  return (
    <View style={styles.container}>
      {/* Cache age banner */}
      {cacheAge && (
        <View style={styles.cacheBar}>
          <Text style={styles.cacheText}>Last synced: {cacheAge}</Text>
        </View>
      )}

      {/* Month navigator */}
      <MonthNavigator
        month={currentMonth}
        year={currentYear}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />

      {schedule ? (
        <FlatList
          data={dayViewModels}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            <ScheduleHeader
              month={schedule.month}
              year={schedule.year}
              crewMemberName={schedule.crewMemberName}
              employeeNumber={schedule.employeeNumber}
              summary={schedule.summary}
            />
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No schedule data</Text>
          <Text style={styles.emptyHint}>
            Fetch your schedule from FLICA
          </Text>
          <TouchableOpacity
            style={styles.fetchButton}
            onPress={() => setWebViewVisible(true)}
          >
            <Text style={styles.fetchButtonText}>Fetch Schedule</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FLICA WebView for login + schedule extraction */}
      <FlicaWebView
        visible={webViewVisible}
        month={currentMonth}
        year={currentYear}
        onScheduleLoaded={onScheduleLoaded}
        onClose={() => setWebViewVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: theme.colors.textMuted,
    marginTop: 12,
    fontSize: theme.fontSize.md,
  },
  errorIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.error,
    marginBottom: 8,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.lg,
    textAlign: 'center',
    fontWeight: '600',
  },
  cacheBar: {
    backgroundColor: theme.colors.backgroundSecondary,
    paddingVertical: 4,
    alignItems: 'center',
  },
  cacheText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  list: {
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  fetchButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: theme.borderRadius.md,
  },
  fetchButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
});
