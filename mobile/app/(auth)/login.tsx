import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { loginSchema } from '@foodbook/shared';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/store/auth';
import { Button, Field, Screen } from '../../src/components/ui';
import { spacing, useColors } from '../../src/theme';

export default function Login() {
  const c = useColors();
  const signIn = useAuth((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setFormError(null);
    // Aceeasi schema ruleaza si pe server: nu pot diverge.
    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join('.'), i.message]),
        ),
      );
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await api.login(parsed.data);
      await signIn(res.user, res.tokens);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Autentificare esuata');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.logo}>🍳</Text>
            <Text style={[styles.title, { color: c.text }]}>FoodBook</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Ce gătesc oamenii pe care îi urmărești
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="maria@exemplu.ro"
            />
            <Field
              label="Parolă"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••"
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            {formError ? (
              <Text style={[styles.formError, { color: c.danger }]}>{formError}</Text>
            ) : null}

            <Button label="Intră în cont" onPress={submit} loading={loading} />
          </View>

          <View style={styles.footer}>
            <Text style={{ color: c.textMuted }}>Nu ai cont?</Text>
            <Link href="/register" style={{ color: c.primary, fontWeight: '700' }}>
              Creează cont
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  brand: { alignItems: 'center', gap: spacing.xs },
  logo: { fontSize: 56 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 15, textAlign: 'center' },
  form: { gap: spacing.lg },
  formError: { fontSize: 14, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
});
