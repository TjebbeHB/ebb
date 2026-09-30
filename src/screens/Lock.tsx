import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Txt } from '../components/ui';
import { getPin } from '../logic/storage';
import { useStore } from '../state';
import { font, space } from '../theme';

export function LockScreen() {
  const { settings, setLocked, palette: p } = useStore();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const [noPin, setNoPin] = useState(false);

  const tryBiometrics = async () => {
    if (Platform.OS === 'web') return;
    try {
      const LA = await import('expo-local-authentication');
      if (!(await LA.hasHardwareAsync()) || !(await LA.isEnrolledAsync())) return;
      const res = await LA.authenticateAsync({ promptMessage: 'Unlock Ebb', cancelLabel: 'Use PIN', disableDeviceFallback: true });
      if (res.success) setLocked(false);
    } catch {
      /* fall back to PIN */
    }
  };

  useEffect(() => {
    void getPin().then((pin) => {
      if (!pin) {
        // Lock enabled but no PIN was ever saved: do not lock the user out.
        setNoPin(true);
        setLocked(false);
      }
    });
    if (settings.lockBiometrics) void tryBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const press = async (d: string) => {
    if (d === 'del') {
      setEntry((e) => e.slice(0, -1));
      return;
    }
    const next = (entry + d).slice(0, 6);
    setEntry(next);
    setError(false);
    const pin = await getPin();
    if (pin && next === pin) {
      setLocked(false);
    } else if (pin && next.length >= pin.length) {
      setError(true);
      setEntry('');
    }
  };

  if (noPin) return null;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, gap: space.xl }}>
      <Txt size={font.title} weight="700">Enter PIN</Txt>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < entry.length ? p.accent : p.border }} />
        ))}
      </View>
      <Txt size={font.small} color={error ? p.danger : p.textFaint}>{error ? 'Wrong PIN. Try again.' : ' '}</Txt>
      <View style={{ width: 260, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 }}>
        {keys.map((k, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? 'Delete' : k}
            disabled={k === ''}
            onPress={() => { void press(k); }}
            style={({ pressed }) => ({ width: 72, height: 72, borderRadius: 36, backgroundColor: k === '' ? 'transparent' : p.surface, borderWidth: k === '' ? 0 : 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Txt size={k === 'del' ? font.body : 26} weight="500">{k === 'del' ? '⌫' : k}</Txt>
          </Pressable>
        ))}
      </View>
      {settings.lockBiometrics ? <Button label="Use Face ID / fingerprint" variant="ghost" onPress={() => { void tryBiometrics(); }} /> : null}
    </View>
  );
}
