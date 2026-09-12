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
import { registerSchema } from '@foodbook/shared';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/store/auth';
import { Button, Field, Screen } from '../../src/components/ui';
import { spacing, useColors } from '../../src/theme';

export default function Register() {
  const c = useColors();
  const signIn = useAuth((s) => s.signIn);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = registerSchema.safeParse({
      displayName: displayName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
      );
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await api.register(parsed.data);
      await signIn(res.user, res.tokens);
    } catch (err) {
      if (err instanceof ApiError) {
        // 409 vine cu mesaj de conflict; il punem pe campul potrivit.
        if (err.status === 409 && err.message.includes('sername')) {
          setErrors({ username: err.message });
        } else if (err.status === 409) {
          setErrors({ email: err.message });
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Inregistrare esuata');
      }
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
            <Text style={[styles.title, { color: c.text }]}>Creează cont</Text>
          </View>

          <View style={styles.form}>
            <Field
              label="Nume afișat"
              value={displayName}
              onChangeText={setDisplayName}
              error={errors.displayName}
              placeholder="Maria Popescu"
              autoComplete="name"
            />
            <Field
              label="Username"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase())}
              error={errors.username}
              hint="Litere mici, cifre și _ . Așa te găsesc ceilalți."
              placeholder="maria_gateste"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              placeholder="maria@exemplu.ro"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Field
              label="Parolă"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              hint="Minim 8 caractere"
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            {formError ? (
              <Text style={[styles.formError, { color: c.danger }]}>{formError}</Text>
            ) : null}

            <Button label="Creează cont" onPress={submit} loading={loading} />
          </View>

          <View style={styles.footer}>
            <Text style={{ color: c.textMuted }}>Ai deja cont?</Text>
            <Link href="/login" style={{ color: c.primary, fontWeight: '700' }}>
              Intră în cont
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.xs },
  logo: { fontSize: 48 },
  title: { fontSize: 26, fontWeight: '800' },
  form: { gap: spacing.lg },
  formError: { fontSize: 14, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
});
