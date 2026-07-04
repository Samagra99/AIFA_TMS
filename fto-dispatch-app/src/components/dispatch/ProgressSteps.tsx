import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme/colors';

const { width } = Dimensions.get('window');

const STEPS = [
  { number: 1, label: 'Pre-Flight', icon: 'clipboard-outline' as const },
  { number: 2, label: 'Weather', icon: 'partly-sunny-outline' as const },
  { number: 3, label: 'Release', icon: 'paper-plane-outline' as const },
] as const;

interface ProgressStepsProps {
  currentStep: 1 | 2 | 3;
}

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  return (
    <View style={styles.container}>
      {STEPS.map((step, idx) => {
        const done = step.number < currentStep;
        const active = step.number === currentStep;
        const upcoming = step.number > currentStep;

        return (
          <React.Fragment key={step.number}>
            <View style={styles.step}>
              {/* Circle */}
              <View
                style={[
                  styles.circle,
                  done && styles.circleDone,
                  active && styles.circleActive,
                  upcoming && styles.circleUpcoming,
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={16} color={C.textInverse} />
                ) : (
                  <Ionicons
                    name={step.icon}
                    size={15}
                    color={active ? C.textInverse : C.textMuted}
                  />
                )}
              </View>

              {/* Label */}
              <Text
                style={[
                  styles.label,
                  active && styles.labelActive,
                  done && styles.labelDone,
                  upcoming && styles.labelUpcoming,
                ]}
              >
                {step.label}
              </Text>

              {/* Step number */}
              <Text style={[styles.number, active && styles.numberActive]}>
                {step.number}/{STEPS.length}
              </Text>
            </View>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <View
                style={[
                  styles.connector,
                  step.number < currentStep && styles.connectorDone,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  step: {
    alignItems: 'center',
    gap: 4,
    width: (width - 48 - 80) / 3,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.bgElevated,
  },
  circleActive: {
    backgroundColor: C.amber,
    borderColor: C.amber,
  },
  circleDone: {
    backgroundColor: C.go,
    borderColor: C.go,
  },
  circleUpcoming: {
    backgroundColor: 'transparent',
    borderColor: C.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    textAlign: 'center',
  },
  labelActive: { color: C.amber, fontWeight: '700' },
  labelDone: { color: C.go },
  labelUpcoming: { color: C.textMuted },
  number: {
    fontSize: 10,
    color: C.textMuted,
  },
  numberActive: { color: C.amberDim },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: C.border,
    marginBottom: 20,
    maxWidth: 40,
  },
  connectorDone: { backgroundColor: C.go },
});
