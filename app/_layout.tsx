import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);
  const loadUserCyphers = useGameStore((s) => s.loadUserCyphers);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserCyphers(user.id);
    }
  }, [user?.id]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000814' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="create" />
        <Stack.Screen name="cyphers" />
        <Stack.Screen name="framework" />
        <Stack.Screen name="store" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="battle" />
        <Stack.Screen
          name="cypher/[id]"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Cypher Structure',
            headerStyle: { backgroundColor: '#001d3d' },
            headerTintColor: '#fff',
          }}
        />
      </Stack>
    </>
  );
}
