import { FoodScreen } from './src/screens/Food';
import { useFonts } from 'expo-font';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import React, { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, Txt } from './src/components/ui';
import { Icon, type IconName } from './src/components/Icon';
import type { ISODate } from './src/logic/dates';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { InsightsScreen } from './src/screens/Insights';
import { LockScreen } from './src/screens/Lock';
import { LogDaySheet } from './src/screens/LogDay';
import { Onboarding } from './src/screens/Onboarding';
import { SettingsScreen } from './src/screens/Settings';
import { TodayScreen } from './src/screens/Today';
import { AppProvider, useStore } from './src/state';
import { font, space } from './src/theme';

type Tab = 'today' | 'calendar' | 'food' | 'insights' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'food', label: 'Food' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' },
];

const TAB_ICONS: Record<Tab, IconName> = { today: 'home', calendar: 'calendar', food: 'food', insights: 'chart', settings: 'sliders' };

function Shell() {
  const { ready, loadError, retryLoad, settings, locked, today, palette: p } = useStore();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('today');
  const [logDate, setLogDate] = useState<ISODate | null>(null);
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [settingsSection, setSettingsSection] = useState('cycle');

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (logDate) {
        setLogDate(null);
        return true;
      }
      if (editingPeriod) {
        setEditingPeriod(false);
        return true;
      }
      if (tab !== 'today') {
        setTab('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [logDate, editingPeriod, tab]);

  if (loadError) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: p.bg }}><Card><Txt serif size={28}>Could not open your diary</Txt><Txt style={{ marginVertical: 16 }} testID="diary-load-error">{loadError}</Txt><Button label="Try loading again" onPress={retryLoad} testID="diary-retry" /></Card></View>;
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  }
  if (locked) return <LockScreen />;
  if (!settings.onboarded) return <Onboarding />;

  const openTrackers = () => {
    setSettingsSection('trackers');
    setTab('settings');
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flex: 1, paddingTop: insets.top, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        {tab === 'today' ? (
          <TodayScreen
            onSettings={() => { setSettingsSection('cycle'); setTab('settings'); }}
            onLog={() => setLogDate(today)}
            onEditPeriod={() => { setTab('calendar'); setEditingPeriod(true); }}
            onOpenCalendar={() => setTab('calendar')}
          />
        ) : null}
        {tab === 'calendar' ? (
          <CalendarScreen onLogDay={(d) => setLogDate(d)} editing={editingPeriod} setEditing={setEditingPeriod} />
        ) : null}
        {tab === 'food' ? <FoodScreen onModels={() => { setSettingsSection('food-ai'); setTab('settings'); }} /> : null}
        {tab === 'insights' ? <InsightsScreen /> : null}
        {tab === 'settings' ? <SettingsScreen section={settingsSection} onSectionChange={setSettingsSection} /> : null}
      </View>

      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8,
          maxWidth: 560, width: '100%', alignSelf: 'center', marginHorizontal: 'auto',
          backgroundColor: p.bg, borderTopWidth: 1, borderTopColor: p.border,
          flexDirection: 'row', justifyContent: 'space-around',
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          const color = active ? p.accent : p.textFaint;
          return (
            <Pressable
              key={t.id}
              testID={`tab-${t.id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              aria-selected={active}
              onPress={() => { setTab(t.id); if (t.id !== 'calendar') setEditingPeriod(false); }}
              style={{ alignItems: 'center', gap: 3, minWidth: 64, paddingVertical: 2 }}
            >
              <View style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, backgroundColor: active ? p.accentSoft : 'transparent' }}>
                <Icon name={TAB_ICONS[t.id]} size={22} color={color} strokeWidth={active ? 2.2 : 1.8} />
              </View>
              <Txt size={font.tiny} weight={active ? '600' : '500'} color={color}>{t.label}</Txt>
            </Pressable>
          );
        })}
      </View>

      {logDate ? (
        <LogDaySheet
          date={logDate}
          visible={!!logDate}
          onClose={() => setLogDate(null)}
          onChangeDate={(d) => { if (d <= today) setLogDate(d); }}
          onOpenTrackers={openTrackers}
        />
      ) : null}
      <View style={{ height: 0, paddingBottom: space.xs }} />
    </View>
  );
}

export default function App() {
  const [loaded, error] = useFonts({ DMSerifDisplay_400Regular, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: '#FFF8E9' }} />;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemedStatusBar />
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  const { palette } = useStore();
  return <StatusBar style={palette.name === "dark" ? "light" : "dark"} />;
}
