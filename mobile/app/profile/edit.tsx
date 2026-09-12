import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { updateProfileSchema } from '@foodbook/shared';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/store/auth';
import { Button, Field, Screen } from '../../src/components/ui';
import { spacing, useColors } from '../../src/theme';

export default function EditProfile() {
  const c = useColors();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = updateProfileSchema.safeParse({
      displayName: displayName.trim(),
      bio: bio.trim() || null,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const updated = await api.updateProfile(parsed.data);
      setUser(updated);
      router.back();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Salvarea a eșuat');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[styles.heading, { color: c.text }]}>Editează profilul</Text>

          <Field
            label="Nume afișat"
            value={displayName}
            onChangeText={setDisplayName}
            error={errors.displayName}
            maxLength={60}
          />
          <Field
            label="Despre tine"
            value={bio}
            onChangeText={setBio}
            error={errors.bio}
            hint={`${bio.length}/300`}
            placeholder="Gătesc de plăcere, mai ales deserturi."
            multiline
            maxLength={300}
          />

          {formError ? <Text style={[styles.error, { color: c.danger }]}>{formError}</Text> : null}

          <View style={{ gap: spacing.md }}>
            <Button label="Salvează" onPress={submit} loading={saving} />
            <Button label="Anulează" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg },
  heading: { fontSize: 24, fontWeight: '800' },
  error: { fontSize: 14, textAlign: 'center' },
});
