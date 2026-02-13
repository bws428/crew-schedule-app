import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../theme';
import {
  saveCredentials,
  clearCredentials,
  hasCredentials as checkHasCredentials,
  getSessionState,
} from '../services/flicaSession';
import { SQLiteScheduleRepository } from '../db/scheduleRepository';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSignIn: (username: string, password: string) => void;
  onSignOut: () => void;
}

export function LoginScreen({ visible, onClose, onSignIn, onSignOut }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [employeeNumber, setEmployeeNumber] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setChecking(true);
      setError(null);
      (async () => {
        try {
          const hasCreds = await checkHasCredentials();
          setConnected(hasCreds);
          if (hasCreds) {
            const state = await getSessionState();
            setEmployeeNumber(state.employeeNumber);
          }
        } catch {
          setConnected(false);
        } finally {
          setChecking(false);
        }
      })();
    }
  }, [visible]);

  const handleSignIn = async () => {
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();
    if (!trimmedUser || !trimmedPass) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await saveCredentials(trimmedUser, trimmedPass);
      setConnected(true);
      setUsername('');
      setPassword('');
      onSignIn(trimmedUser, trimmedPass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    try {
      await clearCredentials();
      const repo = new SQLiteScheduleRepository();
      await repo.clearAll();
      setConnected(false);
      setEmployeeNumber(null);
      setUsername('');
      setPassword('');
      onSignOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>FLICA Account</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Status indicator */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: connected ? '#27AE60' : theme.colors.textMuted },
              ]}
            />
            <Text style={styles.statusText}>
              {checking
                ? 'Checking...'
                : connected
                  ? `Signed in${employeeNumber ? ` (${employeeNumber})` : ''}`
                  : 'Not signed in'}
            </Text>
          </View>

          {checking ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.accent}
              style={{ marginTop: 20 }}
            />
          ) : connected ? (
            <View style={styles.section}>
              <Text style={styles.hint}>
                Your FLICA credentials are stored securely on this device.
                Your password is kept in the OS keychain.
              </Text>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleSignOut}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.error} />
                ) : (
                  <Text style={styles.disconnectText}>Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.hint}>
                Enter your FLICA username and password. Credentials are stored
                securely on this device and used to log in automatically.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="FLICA username"
                placeholderTextColor={theme.colors.textMuted}
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={theme.colors.textMuted}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                secureTextEntry
              />

              <TouchableOpacity
                style={[
                  styles.connectButton,
                  (!username.trim() || !password.trim()) && styles.connectButtonDisabled,
                ]}
                onPress={handleSignIn}
                disabled={loading || !username.trim() || !password.trim()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.connectText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.footerNote}>
            Your password is stored in the OS keychain (iOS Keychain / Android
            Keystore) and never leaves this device except to authenticate with FLICA.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  closeText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  section: {
    marginTop: 20,
  },
  hint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    fontSize: theme.fontSize.md,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.backgroundSecondary,
    marginBottom: 12,
  },
  connectButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.white,
  },
  disconnectButton: {
    borderWidth: 1,
    borderColor: theme.colors.error,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  disconnectText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.error,
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  footerNote: {
    position: 'absolute',
    bottom: 40,
    left: theme.spacing.xl,
    right: theme.spacing.xl,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
