import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PreflightCheck } from '../../types';
import { Button } from '../ui/Button';
import { C } from '../../theme/colors';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// The authoritative pre-flight checklist for DGCA-regulated training flights
export const DEFAULT_CHECKLIST: PreflightCheck[] = [
  { id: 'fuel_qty', label: 'Fuel quantity checked & sufficient for flight + reserves', category: 'FUEL', checked: false },
  { id: 'fuel_caps', label: 'Fuel filler caps secure', category: 'FUEL', checked: false },
  { id: 'fuel_drain', label: 'Fuel sample drained & checked — clear, no water', category: 'FUEL', checked: false },
  { id: 'oil_level', label: 'Engine oil level checked — within limits', category: 'ENGINE', checked: false },
  { id: 'coolant', label: 'Coolant/hydraulic fluid checked (if applicable)', category: 'ENGINE', checked: false },
  { id: 'exhaust', label: 'Exhaust stacks & cowling secure, no cracks', category: 'ENGINE', checked: false },
  { id: 'controls', label: 'Flight controls — free, correct & full travel', category: 'AIRFRAME', checked: false },
  { id: 'surfaces', label: 'Ailerons, elevator, rudder, flaps — no damage', category: 'AIRFRAME', checked: false },
  { id: 'tyres', label: 'Tyre condition & inflation — no cuts or flat spots', category: 'AIRFRAME', checked: false },
  { id: 'brakes', label: 'Brake discs/pads — no visible wear, no fluid leak', category: 'AIRFRAME', checked: false },
  { id: 'static', label: 'Static vents clear (no debris/insects)', category: 'AIRFRAME', checked: false },
  { id: 'pitot', label: 'Pitot tube cover removed & vent clear', category: 'AIRFRAME', checked: false },
  { id: 'lights', label: 'Nav, strobe & landing lights functional', category: 'AIRFRAME', checked: false },
  { id: 'coa', label: 'Certificate of Airworthiness — on board & valid', category: 'DOCUMENTS', checked: false },
  { id: 'radio_lic', label: 'Aircraft Radio Licence — on board & valid', category: 'DOCUMENTS', checked: false },
  { id: 'tech_log', label: 'Tech log reviewed — CRS signed, no open No-Go snags', category: 'DOCUMENTS', checked: false },
  { id: 'journey_log', label: 'Journey log / sector log — available and updated', category: 'DOCUMENTS', checked: false },
  { id: 'weight_bal', label: 'W&B calculated — within approved limits', category: 'PERFORMANCE', checked: false },
  { id: 'takeoff_perf', label: 'Takeoff performance computed — field length OK', category: 'PERFORMANCE', checked: false },
  { id: 'chocks', label: 'Wheel chocks removed', category: 'GROUND', checked: false },
  { id: 'tie_downs', label: 'Tie-down ropes removed', category: 'GROUND', checked: false },
  { id: 'area_clear', label: 'Propeller arc area clear — all personnel back', category: 'GROUND', checked: false },
];

const CATEGORY_ORDER = ['FUEL', 'ENGINE', 'AIRFRAME', 'DOCUMENTS', 'PERFORMANCE', 'GROUND'];
const CATEGORY_LABEL: Record<string, string> = {
  FUEL: '⛽ Fuel',
  ENGINE: '🔧 Engine',
  AIRFRAME: '✈️ Airframe',
  DOCUMENTS: '📋 Documents',
  PERFORMANCE: '📊 Performance',
  GROUND: '🟡 Ground',
};

interface PreFlightStepProps {
  initialChecks: PreflightCheck[];
  preflightBy: string;
  notes: string;
  onComplete: (checks: PreflightCheck[], notes: string, by: string) => void;
}

export function PreFlightStep({
  initialChecks,
  preflightBy: initialBy,
  notes: initialNotes,
  onComplete,
}: PreFlightStepProps) {
  const [checks, setChecks] = useState<PreflightCheck[]>(
    initialChecks.length > 0 ? initialChecks : DEFAULT_CHECKLIST
  );
  const [notes, setNotes] = useState(initialNotes);
  const [by, setBy] = useState(initialBy);

  const toggle = useCallback(async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  }, []);

  // Group checks by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: checks.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0);

  const totalChecked = checks.filter((c) => c.checked).length;
  const allChecked = totalChecked === checks.length;
  const progress = (totalChecked / checks.length) * 100;
  const canProceed = allChecked && by.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {totalChecked}/{checks.length} items checked
        {allChecked && (
          <Text style={styles.progressDone}> — All clear ✓</Text>
        )}
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {grouped.map(({ category, items }) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionHeader}>{CATEGORY_LABEL[category]}</Text>
            {items.map((check) => (
              <CheckItem
                key={check.id}
                item={check}
                onToggle={() => toggle(check.id)}
              />
            ))}
          </View>
        ))}

        {/* Dispatcher name */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>👤 Authorised By</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={16} color={C.textMuted} />
            <TextInput
              style={styles.input}
              value={by}
              onChangeText={setBy}
              placeholder="Dispatcher / Instructor name"
              placeholderTextColor={C.textMuted}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>📝 Remarks</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any defects, snags, or observations noted (optional)"
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Action */}
      <View style={styles.footer}>
        {!allChecked && (
          <Text style={styles.footerHint}>
            Complete all {checks.length - totalChecked} remaining items to proceed
          </Text>
        )}
        <Button
          label="Confirm Pre-Flight → Step 2"
          size="lg"
          fullWidth
          disabled={!canProceed}
          onPress={() => onComplete(checks, notes, by)}
        />
      </View>
    </View>
  );
}

function CheckItem({
  item,
  onToggle,
}: {
  item: PreflightCheck;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onToggle}
      style={[styles.checkRow, item.checked && styles.checkRowDone]}
    >
      <View
        style={[styles.checkbox, item.checked && styles.checkboxDone]}
      >
        {item.checked && (
          <Ionicons name="checkmark" size={14} color={C.textInverse} />
        )}
      </View>
      <Text
        style={[styles.checkLabel, item.checked && styles.checkLabelDone]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressBar: {
    height: 4,
    backgroundColor: C.bgElevated,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.go,
    borderRadius: 2,
  },
  progressLabel: {
    color: C.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  progressDone: { color: C.go, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: isTablet ? 28 : 16, paddingBottom: 16 },
  section: { marginBottom: 20 },
  sectionHeader: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.bgCard,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 52,
  },
  checkRowDone: {
    backgroundColor: `${C.go}0D`,
    borderColor: `${C.go}33`,
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
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: C.go,
    borderColor: C.go,
  },
  checkLabel: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  checkLabelDone: {
    color: C.textMuted,
    textDecorationLine: 'line-through',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    gap: 10,
    height: 52,
  },
  input: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 15,
  },
  notesInput: {
    backgroundColor: C.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    color: C.textPrimary,
    fontSize: 14,
    minHeight: 88,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 10,
    backgroundColor: C.bg,
  },
  footerHint: {
    color: C.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
