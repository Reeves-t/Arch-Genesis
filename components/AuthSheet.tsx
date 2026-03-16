import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';

const { width } = Dimensions.get('window');
const SHEET_WIDTH = width * 0.85;

interface AuthSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthSheet: React.FC<AuthSheetProps> = ({ visible, onClose }) => {
  const { user, loading, signIn, signUp, signOut } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    const errorMsg = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);

    if (errorMsg) {
      setError(errorMsg);
    } else {
      if (mode === 'signup') {
        setError(null);
        setMode('signin');
        setPassword('');
      } else {
        setEmail('');
        setPassword('');
        onClose();
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setEmail('');
    setPassword('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {user ? 'Account' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {user ? (
              /* Signed In State */
              <View style={styles.body}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={40} color="#3b82f6" />
                </View>
                <Text style={styles.emailText}>{user.email}</Text>
                <Text style={styles.idText}>ID: {user.id.slice(0, 8)}...</Text>

                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                  {loading ? (
                    <ActivityIndicator color="#ef4444" />
                  ) : (
                    <Text style={styles.signOutText}>Sign Out</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* Sign In / Sign Up Form */
              <View style={styles.body}>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#6b7280"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry
                  />
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitText}>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError(null);
                  }}
                >
                  <Text style={styles.toggleText}>
                    {mode === 'signin'
                      ? "Don't have an account? Sign Up"
                      : 'Already have an account? Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheetContainer: {
    width: SHEET_WIDTH,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#001d3d',
    paddingTop: 60,
    borderLeftWidth: 1,
    borderLeftColor: '#003566',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#003566',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  body: {
    padding: 24,
    gap: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#003566',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
  },
  idText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#000814',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#003566',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  toggleButton: {
    alignItems: 'center',
    padding: 8,
  },
  toggleText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  signOutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});
