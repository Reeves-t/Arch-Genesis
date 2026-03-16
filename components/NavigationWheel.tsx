import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = width * 0.75;
const SEGMENT_SIZE = 72;
const CENTER = WHEEL_SIZE / 2;
const RADIUS = WHEEL_SIZE / 2 - SEGMENT_SIZE / 2;

interface NavItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Create', icon: 'add-circle', route: '/create', color: '#3b82f6' },
  { label: 'Cyphers', icon: 'grid', route: '/cyphers', color: '#8b5cf6' },
  { label: 'Framework', icon: 'globe', route: '/framework', color: '#06b6d4' },
  { label: 'Store', icon: 'bag', route: '/store', color: '#f59e0b' },
  { label: 'Settings', icon: 'settings', route: '/settings', color: '#6b7280' },
];

export const NavigationWheel: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={[styles.wheel, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
        {/* Center dot */}
        <View style={styles.centerDot} />

        {/* Ring outline */}
        <View style={styles.ring} />

        {/* Nav segments */}
        {NAV_ITEMS.map((item, index) => {
          // Position each item evenly around circle
          // Start from top (-90°) and go clockwise
          const angle = ((360 / NAV_ITEMS.length) * index - 90) * (Math.PI / 180);
          const x = CENTER + RADIUS * Math.cos(angle) - SEGMENT_SIZE / 2;
          const y = CENTER + RADIUS * Math.sin(angle) - SEGMENT_SIZE / 2;

          return (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.segment,
                {
                  left: x,
                  top: y,
                  width: SEGMENT_SIZE,
                  height: SEGMENT_SIZE,
                  borderColor: item.color,
                },
              ]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={24} color={item.color} />
              <Text style={[styles.segmentLabel, { color: item.color }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheel: {
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    top: SEGMENT_SIZE / 2 - 4,
    left: SEGMENT_SIZE / 2 - 4,
    width: WHEEL_SIZE - SEGMENT_SIZE + 8,
    height: WHEEL_SIZE - SEGMENT_SIZE + 8,
    borderRadius: (WHEEL_SIZE - SEGMENT_SIZE + 8) / 2,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    borderStyle: 'dashed',
  },
  centerDot: {
    position: 'absolute',
    top: CENTER - 6,
    left: CENTER - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    opacity: 0.4,
  },
  segment: {
    position: 'absolute',
    borderRadius: SEGMENT_SIZE / 2,
    backgroundColor: '#001d3d',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  segmentLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
