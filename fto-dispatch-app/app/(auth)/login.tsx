import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { C } from '../../src/theme/colors';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect href="/(app)/" />;
  }

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    clearError();
    try {
      await login(username.trim(), password);
    } catch {
      // Error is already in store state
    }
  };

  return (
    <LinearGradient colors={['#050B12', C.bg, '#0D1A2B']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoSection}>
            {/* Aviation silhouette */}
            <View style={styles.logoMark}>
              <Ionicons name="airplane" size={isTablet ? 52 : 40} color={C.amber} />
            </View>
            <Text style={styles.appName}>FTO DISPATCH</Text>
            <Text style={styles.appTagline}>Amravati Flight Training Organisation</Text>
            <View style={styles.divider} />
          </View>

          <View style={[styles.formCard, isTablet && styles.formCardTablet]}>
            <Text style={styles.formTitle}>Sign in to continue</Text>

            {/* Username */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={[styles.inputWrap, username.length > 0 && styles.inputFocused]}>
                <Ionicons name="person-outline" size={18} color={C.textMuted} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(t) => { clearError(); setUsername(t); }}
                  placeholder="DGCA username"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={[styles.inputWrap, password.length > 0 && styles.inputFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(t) => { clearError(); setPassword(t); }}
                  placeholder="Password"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry={!showPw}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
                  <Ionicons
                    name={showPw ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={C.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={C.aog} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              label="Sign In"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={!username.trim() || !password.trim()}
              onPress={handleLogin}
              style={styles.loginBtn}
            />
          </View>

          {/* Version / regulatory footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              This system is authorised for use by FTO staff only.
            </Text>
            <Text style={styles.footerText}>DGCA CAR-ML · SMS Regulated Operation</Text>
            <Text style={styles.version}>v1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    minHeight: height,
  },
  scrollTablet: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: `${C.amber}15`,
    borderWidth: 1.5,
    borderColor: `${C.amber}44`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    color: C.textPrimary,
    fontSize: isTablet ? 30 : 26,
    fontWeight: '900',
    letterSpacing: 3,
  },
  appTagline: {
    color: C.textMuted,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: C.amber,
    borderRadius: 1,
    marginTop: 8,
    opacity: 0.6,
  },
  formCard: {
    backgroundColor: C.bgCard,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    gap: 18,
  },
  formCardTablet: { width: 420 },
  formTitle: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  field: { gap: 8 },
  fieldLabel: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgInput,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  inputFocused: { borderColor: C.amber },
  input: { flex: 1, color: C.textPrimary, fontSize: 15 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.aogMuted,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: C.aog, fontSize: 13, flex: 1 },
  loginBtn: { marginTop: 4 },
  footer: { alignItems: 'center', marginTop: 32, gap: 4 },
  footerText: { color: C.textMuted, fontSize: 11, textAlign: 'center' },
  version: { color: C.textMuted, fontSize: 10, marginTop: 8, opacity: 0.5 },
});
