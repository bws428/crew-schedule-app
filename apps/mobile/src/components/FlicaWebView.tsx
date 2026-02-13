import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { theme } from '../theme';
import { getScheduleParserScript } from '../parsers/scheduleParser';
import type { MonthlySchedule } from '../types/schedule';

const FLICA_BASE = 'https://spirit.flica.net';
const SCHEDULE_PATH = '/full/scheduledetail.cgi';

interface Props {
  visible: boolean;
  month: number;
  year: number;
  onScheduleLoaded: (schedule: MonthlySchedule) => void;
  onClose: () => void;
}

type Status = 'loading' | 'login' | 'captcha' | 'extracting' | 'done' | 'error';

/**
 * WebView that loads FLICA, lets the user log in if needed, and parses
 * the schedule with an injected DOM parser — no server required.
 *
 * The WebView is always visible when the modal is open. If cookies are
 * still valid, the schedule page loads directly and is parsed automatically.
 * If login is required, the user enters credentials in the FLICA web page.
 * If CAPTCHA appears, the user solves it directly.
 */
export function FlicaWebView({
  visible,
  month,
  year,
  onScheduleLoaded,
  onClose,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const extractedRef = useRef(false);
  const retryCountRef = useRef(0);
  const redirectedToLoginRef = useRef(false);
  const navigatedToScheduleRef = useRef(false);

  const blockDate = `${String(month).padStart(2, '0')}${String(year).slice(-2)}`;
  const scheduleUrl = `${FLICA_BASE}${SCHEDULE_PATH}?BlockDate=${blockDate}`;

  // Lightweight detection script — injected on every page load
  const DETECT_PAGE_JS = `
    (function() {
      try {
        // Check for reCAPTCHA
        var recaptcha = document.querySelector('.g-recaptcha')
          || document.querySelector('[src*="recaptcha"]')
          || document.querySelector('iframe[src*="recaptcha"]');
        if (recaptcha) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'captcha' }));
          return;
        }

        // Check for schedule content
        var table2 = document.getElementById('table2');
        var maintable = document.getElementById('maintable');
        if (table2 || maintable) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scheduleReady' }));
          return;
        }

        var bodyText = document.body ? document.body.innerText : '';

        // Check for "Updating schedule in progress"
        if (bodyText.indexOf('Updating schedule in progress') >= 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'updating' }));
          return;
        }

        // Check for login page (has a password input — user can type credentials)
        var passInput = document.querySelector('input[type="password"]');
        if (passInput) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'login' }));
          return;
        }

        // Check for session expired error pages — these are NOT login forms,
        // they're dead-end error pages that need a redirect to the login URL
        if (bodyText.indexOf('InitializeSessionData') >= 0
            || bodyText.indexOf('Sign In to FLICA') >= 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'needsRedirectToLogin' }));
          return;
        }

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'unknown',
          title: document.title,
          url: window.location.href
        }));
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'detectError',
          error: e.message || String(e)
        }));
      }
    })();
    true;
  `;

  const onLoadEnd = useCallback(() => {
    if (extractedRef.current) return;
    setTimeout(() => {
      webViewRef.current?.injectJavaScript(DETECT_PAGE_JS);
    }, 500);
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        // After parser is injected, only accept parser results
        if (extractedRef.current) {
          if (data.type === 'schedule') {
            setStatus('done');
            onScheduleLoaded(data.data as MonthlySchedule);
          } else if (data.type === 'parseError') {
            setStatus('error');
            setErrorMsg(`Parser error: ${data.error}`);
          }
          return;
        }

        switch (data.type) {
          case 'needsRedirectToLogin':
            // Dead-end error page (e.g. "InitializeSessionData() failed")
            // Redirect the WebView to the FLICA login page
            if (!redirectedToLoginRef.current) {
              redirectedToLoginRef.current = true;
              setStatus('loading');
              webViewRef.current?.injectJavaScript(
                `window.location.href = 'https://spirit.flica.net/'; true;`,
              );
            }
            break;

          case 'login':
            // Actual login form — user can type credentials
            setStatus('login');
            break;

          case 'captcha':
            setStatus('captcha');
            break;

          case 'scheduleReady':
            extractedRef.current = true;
            setStatus('extracting');
            webViewRef.current?.injectJavaScript(getScheduleParserScript());
            break;

          case 'updating':
            setStatus('loading');
            retryCountRef.current += 1;
            if (retryCountRef.current <= 6) {
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(DETECT_PAGE_JS);
              }, 3000);
            } else {
              setStatus('error');
              setErrorMsg('FLICA is still updating the schedule. Please try again later.');
            }
            break;

          case 'unknown': {
            // After login, FLICA lands on the main page — navigate to schedule
            var url = data.url || '';
            var isAuthenticated = url.indexOf('/online/') >= 0
              || url.indexOf('/full/') >= 0
              || (url.indexOf('flica.net') >= 0
                  && url.indexOf('login') < 0
                  && url.indexOf('public') < 0
                  && redirectedToLoginRef.current);

            if (isAuthenticated && !navigatedToScheduleRef.current) {
              // We're logged in but not on the schedule page — navigate there
              navigatedToScheduleRef.current = true;
              setStatus('loading');
              webViewRef.current?.injectJavaScript(
                `window.location.href = ${JSON.stringify(scheduleUrl)}; true;`,
              );
            } else {
              // Still loading or redirecting — re-check
              setTimeout(() => {
                if (!extractedRef.current) {
                  webViewRef.current?.injectJavaScript(DETECT_PAGE_JS);
                }
              }, 2000);
            }
            break;
          }

          case 'detectError':
            // Detection script error — keep loading
            break;
        }
      } catch {
        // Non-JSON message — ignore
      }
    },
    [onScheduleLoaded],
  );

  const onNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      if (extractedRef.current) return;
      if (navState.loading === false) {
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(DETECT_PAGE_JS);
        }, 1000);
      }
    },
    [],
  );

  const onShow = useCallback(() => {
    extractedRef.current = false;
    retryCountRef.current = 0;
    redirectedToLoginRef.current = false;
    navigatedToScheduleRef.current = false;
    setStatus('loading');
    setErrorMsg(null);
  }, []);

  const statusLabel: Record<Status, string> = {
    'loading': 'Loading FLICA...',
    'login': 'Log in to FLICA below',
    'captcha': 'Solve the CAPTCHA below',
    'extracting': 'Parsing schedule...',
    'done': 'Schedule loaded!',
    'error': errorMsg || 'An error occurred',
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onShow={onShow}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    status === 'done'
                      ? '#27AE60'
                      : status === 'error'
                        ? theme.colors.error
                        : status === 'captcha' || status === 'login'
                          ? '#F39C12'
                          : theme.colors.accent,
                },
              ]}
            />
            <Text style={styles.statusText} numberOfLines={1}>
              {statusLabel[status]}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>
              {status === 'done' ? 'Done' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Extracting bar */}
        {status === 'extracting' && (
          <View style={styles.parsingBar}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={styles.parsingText}>Processing schedule data...</Text>
          </View>
        )}

        {/* Error display */}
        {status === 'error' && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onClose}>
              <Text style={styles.retryText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WebView — always rendered at full size when not error/done */}
        {status !== 'error' && status !== 'done' && (
          <WebView
            ref={webViewRef}
            source={{ uri: scheduleUrl }}
            style={styles.webview}
            onLoadEnd={onLoadEnd}
            onMessage={onMessage}
            onNavigationStateChange={onNavigationStateChange}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={Platform.OS === 'ios'}
            thirdPartyCookiesEnabled={true}
            userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
            originWhitelist={['https://*', 'http://*']}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.webviewLoadingText}>Connecting to FLICA...</Text>
              </View>
            )}
          />
        )}

        {/* Success state */}
        {status === 'done' && (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Schedule loaded successfully!</Text>
            <Text style={styles.successHint}>Tap Done to view your schedule</Text>
          </View>
        )}
      </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  closeButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.md,
  },
  closeText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  webviewLoadingText: {
    marginTop: 12,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  parsingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: theme.colors.accentLight,
  },
  parsingText: {
    fontSize: 13,
    color: theme.colors.accent,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: theme.colors.error,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.md,
  },
  retryText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.error,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    fontSize: 48,
    color: '#27AE60',
    marginBottom: 16,
  },
  successText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  successHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
});
