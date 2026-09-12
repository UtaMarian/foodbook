import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../src/store/auth';
import { useColors, useIsDark } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Tine navigarea si sesiunea sincronizate, in ambele sensuri. */
function useAuthGate(): void {
  const user = useAuth((s) => s.user);
  const restoring = useAuth((s) => s.restoring);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (restoring) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, restoring, segments, router]);
}

function RootNavigator() {
  const c = useColors();
  const restoring = useAuth((s) => s.restoring);
  useAuthGate();

  if (restoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="recipe/[id]/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="recipe/[id]/edit" options={{ presentation: 'card' }} />
      <Stack.Screen name="recipe/[id]/comments" options={{ presentation: 'modal' }} />
      <Stack.Screen name="user/[username]/index" />
      <Stack.Screen name="user/[username]/followers" />
      <Stack.Screen name="user/[username]/following" />
      <Stack.Screen name="category/[slug]" />
      <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const isDark = useIsDark();
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
