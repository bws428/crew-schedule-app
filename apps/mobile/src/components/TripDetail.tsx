import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trip } from '../types/schedule';
import { theme } from '../theme';

interface Props {
  trip: Trip;
}

export function TripDetail({ trip }: Props) {
  const allLegs = trip.dutyPeriods.flatMap((dp) => dp.legs);
  const cities = [
    ...new Set(allLegs.map((l) => l.origin).concat(allLegs.map((l) => l.destination))),
  ];

  return (
    <View style={styles.container}>
      {/* Route summary */}
      <Text style={styles.routeCities}>{cities.join(' \u2013 ')}</Text>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <MiniStat label="Block" value={trip.totals.block} />
        <MiniStat label="Credit" value={trip.totals.credit} />
        <MiniStat label="TAFB" value={formatTafb(trip.tafb)} />
        <MiniStat label="Legs" value={String(allLegs.length)} />
        {trip.equipment ? <MiniStat label="Equip" value={trip.equipment} /> : null}
      </View>

      {/* Flight legs by duty period */}
      {trip.dutyPeriods.map((dp, dpIdx) => (
        <View key={dpIdx}>
          {dpIdx > 0 && (
            <View style={styles.layoverDivider}>
              <View style={styles.layoverLine} />
              <Text style={styles.layoverText}>
                Layover {trip.dutyPeriods[dpIdx - 1]?.layover?.airport || ''}
                {trip.dutyPeriods[dpIdx - 1]?.layover?.hotelName
                  ? ` \u2014 ${trip.dutyPeriods[dpIdx - 1]?.layover?.hotelName}`
                  : ''}
              </Text>
              <View style={styles.layoverLine} />
            </View>
          )}
          {dp.legs.map((leg, legIdx) => (
            <View key={legIdx} style={styles.legRow}>
              <View style={styles.legTimes}>
                <Text style={styles.legTime}>{leg.departureLocal}</Text>
                <View style={styles.legTimeLine} />
                <Text style={styles.legTime}>{leg.arrivalLocal}</Text>
              </View>
              <View style={styles.legRoute}>
                <Text style={styles.legAirport}>{leg.origin}</Text>
                <Text style={styles.legFlight}>
                  {leg.isDeadhead ? 'DH ' : ''}NK {leg.flightNumber}
                </Text>
                <Text style={styles.legAirport}>{leg.destination}</Text>
              </View>
              <Text style={styles.legBlock}>{leg.blockTime.trim()}</Text>
            </View>
          ))}
        </View>
      ))}

      {/* Crew */}
      {trip.crew.length > 0 && (
        <View style={styles.crewSection}>
          <Text style={styles.crewLabel}>Crew</Text>
          {trip.crew.map((member, idx) => (
            <Text key={idx} style={styles.crewMember}>
              {member.position} \u2013 {member.name} ({member.employeeNumber})
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function formatTafb(tafb: string): string {
  if (!tafb || tafb.length < 4) return tafb;
  const h = parseInt(tafb.substring(0, tafb.length - 2), 10);
  const m = tafb.substring(tafb.length - 2);
  return `${h}:${m}`;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  routeCities: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentLight,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.pill,
    gap: 4,
  },
  miniStatLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  miniStatValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 12,
  },
  legTimes: {
    alignItems: 'center',
    width: 50,
  },
  legTime: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  legTimeLine: {
    width: 1,
    height: 10,
    backgroundColor: theme.colors.accent,
    marginVertical: 2,
  },
  legRoute: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legAirport: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  legFlight: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  legBlock: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
    width: 45,
    textAlign: 'right',
  },
  layoverDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 8,
  },
  layoverLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  layoverText: {
    fontSize: 11,
    color: '#E07B39',
    fontWeight: '500',
  },
  crewSection: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  crewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  crewMember: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
