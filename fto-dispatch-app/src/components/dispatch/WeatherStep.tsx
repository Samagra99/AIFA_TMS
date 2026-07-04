import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WeatherData, WeatherDecision } from '../../types';
import { Button } from '../ui/Button';
import { C } from '../../theme/colors';
import { getCachedWeather } from '../../services/sync.service';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// DGCA VFR minima for day training (CAR-FPL)
const VFR_MINIMA = {
  visibility_km: 5,
  ceiling_ft: 1500,
};

interface WeatherStepProps {
  base: string;
  onComplete: (weatherData: WeatherData, notamAcknowledged: boolean, decision: WeatherDecision) => void;
}

export function WeatherStep({ base, onComplete }: WeatherStepProps) {
  const [notamAck, setNotamAck] = useState(false);
  const [decision, setDecision] = useState<WeatherDecision | null>(null);

  // Determine ICAO station from base name
  const stationMap: Record<string, string> = {
    AMRAVATI: 'VAAW',
    SAT1: 'VAAW',
    SAT2: 'VAAW',
  };
  const station = stationMap[base] ?? 'VAAW';
  const weather = getCachedWeather(station) ?? getMockWeather(station);

  // Auto-suggest decision based on minima
  const meetsVfr =
    weather.visibility >= VFR_MINIMA.visibility_km &&
    (weather.ceiling === null || weather.ceiling >= VFR_MINIMA.ceiling_ft);

  const canProceed = notamAck && decision !== null;

  const handleDecision = async (d: WeatherDecision) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDecision(d);
  };

  const ageMinutes = Math.round((Date.now() - weather.fetchedAt) / 60_000);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* METAR raw */}
        <View style={styles.metarBox}>
          <View style={styles.metarHeader}>
            <Text style={styles.sectionTitle}>METAR / SIGMET</Text>
            <View style={styles.ageTag}>
              <Ionicons name="time-outline" size={11} color={ageMinutes > 60 ? C.aog : C.go} />
              <Text style={[styles.ageText, ageMinutes > 60 && styles.ageStale]}>
                {ageMinutes}m ago
              </Text>
            </View>
          </View>
          <Text style={styles.metar}>{weather.metar}</Text>
          <Text style={styles.station}>{weather.station}</Text>
        </View>

        {/* Decoded display */}
        <View style={styles.grid}>
          <WeatherCell
            icon="navigate-outline"
            label="WIND"
            value={`${String(weather.wind.direction).padStart(3, '0')}° / ${weather.wind.speed} KT`}
            sub={weather.wind.gust ? `Gusting ${weather.wind.gust} KT` : undefined}
            warn={weather.wind.speed > 15 || (weather.wind.gust ?? 0) > 20}
          />
          <WeatherCell
            icon="eye-outline"
            label="VISIBILITY"
            value={`${weather.visibility} KM`}
            warn={weather.visibility < VFR_MINIMA.visibility_km}
            warnText={weather.visibility < VFR_MINIMA.visibility_km ? 'Below VFR min' : undefined}
          />
          <WeatherCell
            icon="cloudy-outline"
            label="CEILING"
            value={weather.ceiling !== null ? `${weather.ceiling} FT` : 'CAVOK'}
            warn={weather.ceiling !== null && weather.ceiling < VFR_MINIMA.ceiling_ft}
            warnText={weather.ceiling !== null && weather.ceiling < VFR_MINIMA.ceiling_ft ? 'Below VFR min' : undefined}
          />
          <WeatherCell
            icon="speedometer-outline"
            label="QNH"
            value={`${weather.qnh} hPa`}
          />
          <WeatherCell
            icon="thermometer-outline"
            label="TEMP / DP"
            value={`${weather.temperature}° / ${weather.dewpoint}°C`}
          />
          <WeatherCell
            icon="partly-sunny-outline"
            label="CONDITIONS"
            value={weather.conditions.length > 0 ? weather.conditions.join(' ') : 'NIL'}
          />
        </View>

        {/* VFR assessment banner */}
        <View style={[styles.vfrBanner, meetsVfr ? styles.vfrGo : styles.vfrNoGo]}>
          <Ionicons
            name={meetsVfr ? 'checkmark-circle' : 'close-circle'}
            size={22}
            color={meetsVfr ? C.go : C.aog}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.vfrTitle, { color: meetsVfr ? C.go : C.aog }]}>
              {meetsVfr ? 'VFR MINIMA MET' : 'VFR MINIMA NOT MET'}
            </Text>
            <Text style={styles.vfrSub}>
              {meetsVfr
                ? `Vis ≥ ${VFR_MINIMA.visibility_km} km · Ceiling ≥ ${VFR_MINIMA.ceiling_ft} ft`
                : `Required: Vis ≥ ${VFR_MINIMA.visibility_km} km, Ceiling ≥ ${VFR_MINIMA.ceiling_ft} ft`}
            </Text>
          </View>
        </View>

        {/* NOTAM acknowledgment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTAM Review</Text>
          <Text style={styles.notamBody}>
            Dispatcher confirms that applicable NOTAMs have been reviewed for the
            departure / destination aerodrome and route. No valid NOTAM restricts
            or prohibits the planned flight.
          </Text>
          <TouchableOpacity
            style={styles.notamCheck}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setNotamAck((v) => !v);
            }}
          >
            <View style={[styles.checkbox, notamAck && styles.checkboxDone]}>
              {notamAck && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
            </View>
            <Text style={styles.notamCheckLabel}>
              NOTAMs reviewed — no restrictions apply to this flight
            </Text>
          </TouchableOpacity>
        </View>

        {/* Go / No-Go decision */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dispatcher Decision</Text>
          <View style={styles.decisionRow}>
            <TouchableOpacity
              style={[styles.decBtn, styles.goBtn, decision === 'GO' && styles.decBtnSelected]}
              onPress={() => handleDecision('GO')}
            >
              <Ionicons name="checkmark-circle" size={28} color={decision === 'GO' ? C.textInverse : C.go} />
              <Text style={[styles.decLabel, decision === 'GO' && styles.decLabelSelected]}>GO</Text>
              <Text style={styles.decSub}>Flight approved to proceed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.decBtn, styles.noGoBtn, decision === 'NO_GO' && styles.noGoBtnSelected]}
              onPress={() => handleDecision('NO_GO')}
            >
              <Ionicons name="close-circle" size={28} color={decision === 'NO_GO' ? '#fff' : C.aog} />
              <Text style={[styles.decLabel, decision === 'NO_GO' && styles.decLabelSelected]}>NO-GO</Text>
              <Text style={styles.decSub}>Flight cancelled — weather</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <View style={styles.footer}>
        {!notamAck && (
          <Text style={styles.footerHint}>Acknowledge NOTAM review to continue</Text>
        )}
        {!decision && notamAck && (
          <Text style={styles.footerHint}>Select GO or NO-GO decision</Text>
        )}
        <Button
          label={decision === 'NO_GO' ? 'Cancel Flight (NO-GO)' : 'Confirm Briefing → Step 3'}
          variant={decision === 'NO_GO' ? 'danger' : 'primary'}
          size="lg"
          fullWidth
          disabled={!canProceed}
          onPress={() => onComplete(weather, notamAck, decision!)}
        />
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeatherCell({
  icon,
  label,
  value,
  sub,
  warn,
  warnText,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  warnText?: string;
}) {
  return (
    <View style={[styles.cell, warn && styles.cellWarn]}>
      <Ionicons name={icon} size={14} color={warn ? C.aog : C.textMuted} />
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, warn && styles.cellValueWarn]}>{value}</Text>
      {(sub ?? warnText) && (
        <Text style={[styles.cellSub, warn && styles.cellSubWarn]}>
          {warnText ?? sub}
        </Text>
      )}
    </View>
  );
}

// Fallback mock weather when API not yet reached
function getMockWeather(station: string): WeatherData {
  return {
    station,
    metar: `${station} ${new Date().toISOString().slice(11, 16).replace(':', '')}Z 09010KT 9999 FEW030 27/18 Q1013`,
    wind: { direction: 90, speed: 10 },
    qnh: 1013,
    visibility: 9.9,
    ceiling: null,
    temperature: 27,
    dewpoint: 18,
    conditions: ['FEW030'],
    fetchedAt: Date.now() - 5 * 60_000,
  };
}

const CELL_W = isTablet ? (width - 80) / 3 : (width - 52) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: isTablet ? 24 : 16, gap: 16 },
  metarBox: {
    backgroundColor: C.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  metarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  ageTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ageText: { color: C.go, fontSize: 11 },
  ageStale: { color: C.aog },
  metar: { color: C.textPrimary, fontFamily: 'Courier', fontSize: 13, lineHeight: 20 },
  station: { color: C.textMuted, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    backgroundColor: C.bgCard,
    borderRadius: 10,
    padding: 12,
    gap: 3,
    width: CELL_W,
    borderWidth: 1,
    borderColor: C.border,
  },
  cellWarn: { borderColor: `${C.aog}44`, backgroundColor: '#160B0B' },
  cellLabel: { color: C.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  cellValue: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  cellValueWarn: { color: C.aog },
  cellSub: { color: C.textMuted, fontSize: 10 },
  cellSubWarn: { color: C.aog, fontWeight: '600' },
  vfrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
  },
  vfrGo: { backgroundColor: `${C.go}0D`, borderColor: `${C.go}44` },
  vfrNoGo: { backgroundColor: `${C.aog}0D`, borderColor: `${C.aog}44` },
  vfrTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
  vfrSub: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  section: { gap: 10 },
  notamBody: { color: C.textSecondary, fontSize: 13, lineHeight: 20, backgroundColor: C.bgCard, padding: 12, borderRadius: 10 },
  notamCheck: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: C.bgCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxDone: { backgroundColor: C.go, borderColor: C.go },
  notamCheckLabel: { color: C.textPrimary, fontSize: 14, lineHeight: 20, flex: 1 },
  decisionRow: { flexDirection: 'row', gap: 12 },
  decBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.bgCard,
  },
  goBtn: { borderColor: `${C.go}44` },
  noGoBtn: { borderColor: `${C.aog}44` },
  decBtnSelected: { backgroundColor: C.go, borderColor: C.go },
  noGoBtnSelected: { backgroundColor: C.aog, borderColor: C.aog },
  decLabel: { fontSize: 22, fontWeight: '900', letterSpacing: 1, color: C.textPrimary },
  decLabelSelected: { color: C.textInverse },
  decSub: { color: C.textMuted, fontSize: 11, textAlign: 'center' },
  footer: {
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 10,
    backgroundColor: C.bg,
  },
  footerHint: { color: C.textMuted, fontSize: 12, textAlign: 'center' },
});
