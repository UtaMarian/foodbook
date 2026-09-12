import { ReactNode, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { radius, spacing, useColors } from '../theme';

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: ViewStyle;
}) {
  const c = useColors();
  const inert = disabled || loading;

  const bg = {
    primary: c.primary,
    secondary: c.surfaceAlt,
    ghost: 'transparent',
    danger: 'transparent',
  }[variant];

  const fg = {
    primary: c.primaryText,
    secondary: c.text,
    ghost: c.textMuted,
    danger: c.danger,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inert, busy: !!loading }}
      onPress={inert ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: inert ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' || variant === 'danger' ? { paddingVertical: spacing.sm } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textFaint}
        {...props}
        style={[
          styles.input,
          {
            backgroundColor: c.surface,
            borderColor: error ? c.danger : c.border,
            color: c.text,
          },
          props.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null,
          props.style,
        ]}
      />
      {error ? (
        <Text style={[styles.helper, { color: c.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: c.textFaint }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  emoji,
  title,
  message,
  action,
}: {
  emoji: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: c.textMuted }]}>{message}</Text>
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      emoji="😕"
      title="Ceva n-a mers"
      message={message}
      action={onRetry ? <Button label="Incearca din nou" onPress={onRetry} /> : undefined}
    />
  );
}

/** Skeleton cu puls: ecranul are forma finala inainte sa vina datele. */
export function Skeleton({ height, width, style }: { height: number; width?: number | string; style?: ViewStyle }) {
  const c = useColors();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { height, width: (width as number) ?? '100%', backgroundColor: c.skeleton, borderRadius: radius.sm, opacity: pulse },
        style,
      ]}
    />
  );
}

export function Screen({ children, style }: { children?: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  helper: { fontSize: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xs, flexGrow: 1 },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMessage: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
