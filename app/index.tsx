import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavigationWheel } from '../components/NavigationWheel';
import { AuthSheet } from '../components/AuthSheet';
import { useAuthStore } from '../store/useAuthStore';

export default function HomeScreen() {
  const [authVisible, setAuthVisible] = useState(false);
  const { user } = useAuthStore();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content}>
        {/* Top bar with auth icon */}
        <View style={styles.topBar}>
          <View style={styles.spacer} />
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => setAuthVisible(true)}
          >
            <Ionicons
              name={user ? 'person-circle' : 'person-circle-outline'}
              size={32}
              color={user ? '#3b82f6' : '#6b7280'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Arch:Genesis</Text>
          <Text style={styles.subtitle}>THE FRAMEWORK</Text>
        </View>

        <View style={styles.wheelContainer}>
          <NavigationWheel />
        </View>
      </SafeAreaView>

      <AuthSheet
        visible={authVisible}
        onClose={() => setAuthVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000814',
  },
  content: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  spacer: { width: 32 },
  authButton: { padding: 4 },
  header: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#3b82f6',
    letterSpacing: 4,
    marginTop: 4,
  },
  wheelContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
