import { FoodModels } from './FoodModels';
import { HealthConnections } from './HealthConnections';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import {
  Button, Card, Chip, ChipGroup, Divider, Field, Heading, Row, ScreenHeader, Segmented, Stepper, ToggleRow, Txt,
} from '../components/ui';
import { ImportSheet } from '../components/ImportSheet';
import { BIRTH_CONTROL_LABELS, DISCLAIMER, GOAL_HINTS, GOAL_LABELS, PRIVACY } from '../logic/content';
import { exportText, parseImport, pickImportText, toCSV, toJSON } from '../logic/exportImport';
import { ensurePermission, notificationsSupported } from '../logic/notifications';
import { clearPin, pinAvailable, setPin } from '../logic/storage';
import { CATEGORIES } from '../logic/trackers';
import type { BirthControl, Goal, ReminderTime, Reminders } from '../logic/types';
import { useStore } from '../state';
import { font, space } from '../theme';

const GOALS: Goal[] = ['track', 'conceive', 'avoid', 'birthcontrol'];
const BC: BirthControl[] = ['none', 'pill', 'iud_hormonal', 'iud_copper', 'implant', 'injection', 'ring', 'patch', 'condoms', 'other'];

function confirm(title: string, message: string, onYes: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: destructive ? 'Delete' : 'OK', style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function fmtTime(t: ReminderTime): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

export function SettingsScreen({ section, onSectionChange }: { section: string; onSectionChange: (s: string) => void }) {
  const { settings, updateSettings, data, replaceData, resetAll, palette: p, model } = useStore();
  const [notifOk, setNotifOk] = useState<boolean | null>(null);
  const [pinOk, setPinOk] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    void notificationsSupported().then(setNotifOk);
    void pinAvailable().then(setPinOk);
  }, []);

  const rem = settings.reminders;
  const setRem = <K extends keyof Reminders>(key: K, patch: Partial<Reminders[K]>) => {
    updateSettings({ reminders: { ...rem, [key]: { ...rem[key], ...patch } } });
  };

  const enableReminder = async <K extends keyof Reminders>(key: K, v: boolean) => {
    if (v && notifOk) {
      const ok = await ensurePermission();
      if (!ok) {
        notify('Notifications are off', 'Allow notifications for Ebb in your system settings to use reminders.');
        return;
      }
    }
    setRem(key, { enabled: v } as Partial<Reminders[K]>);
  };

  const reminderRow = <K extends keyof Reminders>(key: K, label: string, hint?: string, extra?: React.ReactNode) => {
    const r = rem[key] as ReminderTime;
    return (
      <View key={key}>
        <ToggleRow label={label} hint={hint} value={r.enabled} onChange={(v) => { void enableReminder(key, v); }} testID={`rem-${key}`} />
        {r.enabled ? (
          <View style={{ paddingLeft: space.sm, paddingBottom: space.sm, gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt size={font.small} muted>Time</Txt>
              <Row>
                <Stepper value={r.hour} min={0} max={23} onChange={(hour) => setRem(key, { hour } as Partial<Reminders[K]>)} format={(v) => String(v).padStart(2, '0')} />
                <Txt>:</Txt>
                <Stepper value={r.minute} min={0} max={45} step={15} onChange={(minute) => setRem(key, { minute } as Partial<Reminders[K]>)} format={(v) => String(v).padStart(2, '0')} />
              </Row>
            </Row>
            {extra}
          </View>
        ) : null}
        <Divider />
      </View>
    );
  };

  const doExport = async (kind: 'json' | 'csv') => {
    setBusy(true);
    const stamp = new Date().toISOString().slice(0, 10);
    const res = kind === 'json'
      ? await exportText(`ebb-backup-${stamp}.json`, toJSON(data), 'application/json')
      : await exportText(`ebb-log-${stamp}.csv`, toCSV(data), 'text/csv');
    setBusy(false);
    setMessage(res.message);
  };

  const doImport = async () => {
    try {
      setBusy(true);
      const text = await pickImportText();
      setBusy(false);
      if (!text) return;
      const parsed = parseImport(text);
      const n = Object.keys(parsed.logs).length;
      confirm('Replace all data?', `The backup contains ${n} logged days. Your current data on this device will be replaced.`, () => {
        replaceData(parsed);
        setMessage(`Imported ${n} days.`);
      }, false);
    } catch (e) {
      setBusy(false);
      notify('Import failed', (e as Error).message);
    }
  };

  const sections: { id: string; label: string }[] = [
    { id: 'cycle', label: 'Cycle' },
    { id: 'trackers', label: 'Trackers' },
    { id: 'reminders', label: 'Reminders' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'health', label: 'Health' },
    { id: 'food-ai', label: 'Food AI' },
    { id: 'data', label: 'Data' },
    { id: 'about', label: 'About' },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} testID="settings-screen" keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Settings" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}>
        {sections.map((s) => (
          <Chip key={s.id} label={s.label} selected={section === s.id} onPress={() => onSectionChange(s.id)} testID={`settings-tab-${s.id}`} />
        ))}
      </ScrollView>

      {message ? (
        <Card style={{ marginBottom: space.md, backgroundColor: p.accentSoft, borderColor: p.accent }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt size={font.small} style={{ flex: 1 }} testID="settings-message">{message}</Txt>
            <Button label="OK" small variant="ghost" onPress={() => setMessage(null)} />
          </Row>
        </Card>
      ) : null}

      {section === 'health' ? <HealthConnections /> : null}

      {section === 'cycle' ? (
        <View style={{ gap: space.lg }}>
          <Card style={{ gap: space.md }}>
            <Heading>Goal</Heading>
            <View style={{ gap: space.sm }}>
              {GOALS.map((g) => (
                <Chip key={g} label={GOAL_LABELS[g]} selected={settings.goal === g} onPress={() => updateSettings({ goal: g, cautiousFertileWindow: g === 'avoid' ? true : settings.cautiousFertileWindow })} style={{ alignSelf: 'flex-start' }} testID={`settings-goal-${g}`} />
              ))}
            </View>
            <Txt size={font.small} muted>{GOAL_HINTS[settings.goal]}</Txt>
          </Card>
          <Card style={{ gap: space.md }}>
            <Heading>Birth control</Heading>
            <ChipGroup options={BC.map((b) => ({ id: b, label: BIRTH_CONTROL_LABELS[b] ?? b }))} selected={settings.birthControl} onToggle={(id) => updateSettings({ birthControl: id as BirthControl })} />
            {!model.fertilityEnabled ? <Txt size={font.small} muted>Hormonal birth control usually suppresses ovulation, so fertile days and ovulation are not shown.</Txt> : null}
          </Card>
          <Card style={{ gap: space.md }}>
            <Heading>Cycle defaults</Heading>
            <Txt size={font.small} muted>Used until enough cycles are logged. Currently predicting {model.predictedCycleLength}-day cycles{model.stats.validCycleCount >= 2 ? ' from your history' : ' from these defaults'}.</Txt>
            <Row style={{ justifyContent: 'space-between' }}><Txt>Cycle length</Txt><Stepper value={settings.defaultCycleLength} min={15} max={60} onChange={(v) => updateSettings({ defaultCycleLength: v })} testID="set-cycle-len" /></Row>
            <Row style={{ justifyContent: 'space-between' }}><Txt>Period length</Txt><Stepper value={settings.defaultPeriodLength} min={1} max={12} onChange={(v) => updateSettings({ defaultPeriodLength: v })} /></Row>
            <Row style={{ justifyContent: 'space-between' }}><Txt>Luteal phase</Txt><Stepper value={settings.lutealLength} min={8} max={18} onChange={(v) => updateSettings({ lutealLength: v })} /></Row>
            <Txt size={font.small} muted>Days from ovulation to the next period. Replaced by your own average once temperature shifts have supported an estimate in two or more cycles.</Txt>
            <ToggleRow label="Cautious fertile window" hint="Adds two days on each side of the estimated fertile window." value={settings.cautiousFertileWindow} onChange={(v) => updateSettings({ cautiousFertileWindow: v })} />
          </Card>
          <Card style={{ gap: space.md }}>
            <Heading>Display</Heading>
            <Txt size={font.small} muted>Theme</Txt>
            <Segmented options={[{ id: 'system', label: 'System' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} value={settings.theme} onChange={(theme) => updateSettings({ theme })} testPrefix="theme" />
            <Txt size={font.small} muted>Week starts on</Txt>
            <Segmented options={[{ id: '1', label: 'Monday' }, { id: '0', label: 'Sunday' }]} value={String(settings.firstDayOfWeek) as '0' | '1'} onChange={(v) => updateSettings({ firstDayOfWeek: Number(v) as 0 | 1 })} />
            <Txt size={font.small} muted>Temperature</Txt>
            <Segmented options={[{ id: 'c', label: '°C' }, { id: 'f', label: '°F' }]} value={settings.tempUnit} onChange={(tempUnit) => updateSettings({ tempUnit })} />
            <Txt size={font.small} muted>Weight</Txt>
            <Segmented options={[{ id: 'kg', label: 'kg' }, { id: 'lb', label: 'lb' }]} value={settings.weightUnit} onChange={(weightUnit) => updateSettings({ weightUnit })} />
          </Card>
        </View>
      ) : null}

      {section === 'trackers' ? (
        <View style={{ gap: space.lg }}>
          <Card>
            <Heading>Trackers shown in the log</Heading>
            <Txt size={font.small} muted style={{ marginBottom: space.sm }}>Hide what you do not use. Existing entries are kept.</Txt>
            {CATEGORIES.map((c) => (
              <ToggleRow
                key={c.id}
                label={c.label}
                hint={c.hint}
                value={settings.enabledCategories.includes(c.id)}
                onChange={(v) => updateSettings({ enabledCategories: v ? [...settings.enabledCategories, c.id] : settings.enabledCategories.filter((x) => x !== c.id) })}
                testID={`tracker-${c.id}`}
              />
            ))}
          </Card>
          <Card style={{ gap: space.sm }}>
            <Heading>Custom tags and symptoms</Heading>
            <Txt size={font.small} muted>Tap to remove. Add new ones from the log screen.</Txt>
            <Txt size={font.small} weight="600" style={{ marginTop: space.sm }}>Tags</Txt>
            <ChipGroup options={settings.customTags.map((t) => ({ id: t, label: `${t} ×` }))} selected={[]} onToggle={(id) => confirm('Remove tag?', `"${id}" will be removed from the list. Days already tagged keep it.`, () => updateSettings({ customTags: settings.customTags.filter((t) => t !== id) }))} />
            {settings.customTags.length === 0 ? <Txt size={font.small} faint>None yet.</Txt> : null}
            <Txt size={font.small} weight="600" style={{ marginTop: space.sm }}>Symptoms</Txt>
            <ChipGroup options={settings.customSymptoms.map((t) => ({ id: t, label: `${t} ×` }))} selected={[]} onToggle={(id) => confirm('Remove symptom?', `"${id}" will be removed from the list.`, () => updateSettings({ customSymptoms: settings.customSymptoms.filter((t) => t !== id) }))} />
            {settings.customSymptoms.length === 0 ? <Txt size={font.small} faint>None yet.</Txt> : null}
          </Card>
        </View>
      ) : null}

      {section === 'reminders' ? (
        <Card>
          <Heading>Reminders</Heading>
          <Txt size={font.small} muted style={{ marginBottom: space.sm }}>
            {notifOk === false ? 'Reminders are only available in the iOS and Android apps.' : 'Local notifications, scheduled on this device. The wording is deliberately vague so nothing private shows on your lock screen.'}
          </Txt>
          {reminderRow('periodBefore', 'Before my period', 'A heads-up a few days ahead.', (
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt size={font.small} muted>Days before</Txt>
              <Stepper value={rem.periodBefore.daysBefore} min={1} max={7} onChange={(daysBefore) => setRem('periodBefore', { daysBefore })} />
            </Row>
          ))}
          {reminderRow('periodStart', 'Period expected', 'On the predicted first day.')}
          {reminderRow('periodLate', 'Period late', 'Two days after the predicted date, if nothing is logged.')}
          {model.fertilityEnabled ? reminderRow('fertileStart', 'Fertile window opens') : null}
          {model.fertilityEnabled ? reminderRow('ovulation', 'Estimated ovulation') : null}
          {reminderRow('dailyLog', 'Daily check-in', 'A nudge to log the day.')}
          {settings.enabledCategories.includes('pill') ? reminderRow('pill', 'Pill', 'Every day at the same time.') : null}
          {settings.enabledCategories.includes('bbt') ? reminderRow('bbt', 'Take temperature', 'Every morning.') : null}
        </Card>
      ) : null}

      {section === 'privacy' ? (
        <View style={{ gap: space.lg }}>
          <Card>
            <Heading>How your data is handled</Heading>
            <Txt size={font.small} muted style={{ marginTop: space.sm }}>{PRIVACY}</Txt>
          </Card>
          <Card style={{ gap: space.sm }}>
            <Heading>App lock</Heading>
            {!pinOk ? <Txt size={font.small} muted>App lock is available in the iOS and Android apps.</Txt> : null}
            {pinOk ? (
              <>
                <ToggleRow
                  label="Require a PIN to open Ebb"
                  value={settings.lockEnabled}
                  onChange={(v) => {
                    if (!v) {
                      void clearPin();
                      updateSettings({ lockEnabled: false, lockBiometrics: false });
                    } else {
                      setPinEntry('');
                      updateSettings({ lockEnabled: true });
                    }
                  }}
                  testID="lock-toggle"
                />
                {settings.lockEnabled ? (
                  <View style={{ gap: space.sm }}>
                    <Row>
                      <Field value={pinEntry} onChangeText={(t) => setPinEntry(t.replace(/\D/g, '').slice(0, 6))} placeholder="4 to 6 digit PIN" keyboardType="number-pad" style={{ flex: 1 }} testID="pin-input" />
                      <Button
                        label="Set PIN"
                        small
                        disabled={pinEntry.length < 4}
                        onPress={async () => {
                          await setPin(pinEntry);
                          setPinEntry('');
                          setMessage('PIN saved. It will be asked the next time Ebb opens.');
                        }}
                        testID="pin-save"
                      />
                    </Row>
                    <ToggleRow label="Unlock with Face ID / fingerprint" hint="Falls back to the PIN." value={settings.lockBiometrics} onChange={(v) => updateSettings({ lockBiometrics: v })} />
                    <Txt size={font.small} muted>If you forget the PIN, the only way back in is to delete the app, which also deletes your data. Keep a backup.</Txt>
                  </View>
                ) : null}
              </>
            ) : null}
          </Card>
        </View>
      ) : null}

      {section === 'food-ai' ? <FoodModels /> : null}

      {section === 'data' ? (
        <View style={{ gap: space.lg }}>
          <Card style={{ gap: space.sm }}>
            <Heading>Bring history from another app</Heading>
            <Txt size={font.small} muted>Add periods, symptoms and more from a Flo export file or from Apple Health. Your existing entries are kept.</Txt>
            <Button label="Import from Flo or Apple Health" variant="secondary" iconLeft="upload" onPress={() => setImportOpen(true)} testID="open-import" />
          </Card>
          <Card style={{ gap: space.sm }}>
            <Heading>Backup</Heading>
            <Txt size={font.small} muted>Ebb never uploads anything. Meal details are included in JSON backups; photos are not. To keep your history when you switch phones, save a backup file somewhere you control and import it on the new device.</Txt>
            <Button label="Export backup (JSON)" variant="secondary" iconLeft="download" disabled={busy} onPress={() => { void doExport('json'); }} testID="export-json" />
            <Button label="Export spreadsheet (CSV)" variant="secondary" iconLeft="download" disabled={busy} onPress={() => { void doExport('csv'); }} testID="export-csv" />
            <Button label="Restore an Ebb backup" variant="secondary" disabled={busy} onPress={() => { void doImport(); }} testID="import-json" />
            <Txt size={font.tiny} faint>{Object.keys(data.logs).length} days logged on this device.</Txt>
          </Card>
          <Card style={{ gap: space.sm }}>
            <Heading>Delete everything</Heading>
            <Txt size={font.small} muted>Removes all logs, meals, saved photos, settings and downloaded models from this device. Cannot be undone.</Txt>
            <Button label="Delete all data" variant="danger" onPress={() => confirm('Delete all data?', 'All logs, meals, saved photos, settings and downloaded models on this device will be erased.', () => { void resetAll().catch(() => notify('Could not finish deleting', 'Please try again. Some data or model files may remain.')); })} testID="delete-all" />
          </Card>
        </View>
      ) : null}

      {section === 'about' ? (
        <View style={{ gap: space.lg }}>
          <Card>
            <Heading>Ebb</Heading>
            <Txt size={font.small} muted style={{ marginTop: space.sm }}>A free, private cycle tracker. No account, no subscription, no data leaves your phone. Version 1.4.0.</Txt>
          </Card>
          <Card>
            <Heading>How predictions work</Heading>
            <Txt size={font.small} muted style={{ marginTop: space.sm }}>
              The next period is predicted from the median length of your last six cycles (unusually short or long cycles and cycles you exclude are ignored). Ovulation is estimated by counting the luteal phase (14 days by default) back from the predicted period. The fertile window is the five days before ovulation, ovulation day and the day after. Temperature shifts, LH tests and mucus peaks offer indirect clues about ovulation, not confirmation. Only temperature-supported estimates inform your personal luteal length. Hormonal birth control switches ovulation estimates off.
            </Txt>
          </Card>
          <Card>
            <Heading>Not medical advice</Heading>
            <Txt size={font.small} muted style={{ marginTop: space.sm }}>{DISCLAIMER}</Txt>
          </Card>
        </View>
      ) : null}
      <ImportSheet visible={importOpen} onClose={() => setImportOpen(false)} onImported={(b) => setMessage(`Added ${b.summary.days} days from ${b.summary.source === 'flo' ? 'Flo' : 'Apple Health'}.`)} />
    </ScrollView>
  );
}
