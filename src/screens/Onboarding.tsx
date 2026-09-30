import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonthGrid, MonthNav } from '../components/Calendar';
import { Icon, type IconName } from '../components/Icon';
import { ImportSheet } from '../components/ImportSheet';
import { Button, Card, Chip, Row, Stepper, Title, Txt } from '../components/ui';
import { buildModel } from '../logic/cycles';
import { BIRTH_CONTROL_LABELS, GOAL_HINTS, GOAL_LABELS } from '../logic/content';
import { addDays, addMonths, fromISO, MONTHS, type ISODate } from '../logic/dates';
import type { ImportBundle } from '../logic/importMerge';
import type { BirthControl, Goal } from '../logic/types';
import { useStore } from '../state';
import { font, space } from '../theme';

const GOALS: Goal[] = ['track', 'conceive', 'avoid', 'birthcontrol'];
const BC: BirthControl[] = ['none', 'pill', 'iud_hormonal', 'iud_copper', 'implant', 'injection', 'ring', 'patch', 'condoms', 'other'];

function Promise_({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { palette: p } = useStore();
  return (
    <Row gap={12} align="flex-start">
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={p.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="600">{title}</Txt>
        <Txt size={font.small} muted>{body}</Txt>
      </View>
    </Row>
  );
}

export function Onboarding() {
  const { settings, updateSettings, setFlowForDays, today, palette: p, logs } = useStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>('track');
  const [bc, setBc] = useState<BirthControl>('none');
  const [cycleLen, setCycleLen] = useState(28);
  const [periodLen, setPeriodLen] = useState(5);
  const [lastStart, setLastStart] = useState<ISODate | undefined>();
  const [month, setMonth] = useState<ISODate>(`${today.slice(0, 7)}-01`);
  const [importOpen, setImportOpen] = useState(false);
  const [imported, setImported] = useState<ImportBundle | null>(null);

  const finish = (skipPeriod: boolean) => {
    if (!skipPeriod && lastStart) {
      const days = Array.from({ length: periodLen }, (_, i) => addDays(lastStart, i)).filter((d) => d <= today);
      setFlowForDays(days.map((date, i) => ({ date, flow: i === 0 ? 'medium' : i === days.length - 1 ? 'light' : 'medium' })));
    }
    updateSettings({
      onboarded: true,
      goal,
      birthControl: bc,
      defaultCycleLength: cycleLen,
      defaultPeriodLength: periodLen,
      cautiousFertileWindow: goal === 'avoid',
      enabledCategories: goal === 'conceive'
        ? ['flow', 'symptoms', 'moods', 'energy', 'sleep', 'sex', 'discharge', 'bbt', 'tests', 'notes']
        : goal === 'birthcontrol' || ['pill', 'ring', 'patch'].includes(bc)
          ? ['flow', 'symptoms', 'moods', 'energy', 'sleep', 'sex', 'pill', 'notes']
          : settings.enabledCategories,
    });
  };

  const md = fromISO(month);
  const previewModel = buildModel(logs, settings, today);
  const hasImportedPeriods = !!imported && imported.summary.bleedingDays > 0;

  const steps = [
    <View key="welcome" style={{ gap: space.xl }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="circle-dot" size={30} color={p.onAccent} strokeWidth={2.2} />
      </View>
      <View style={{ gap: space.sm }}>
        <Title>Your cycle, on your terms.</Title>
        <Txt muted>Periods, symptoms, moods and fertility signs, with predictions that learn from your history. Free, with nothing behind a paywall.</Txt>
      </View>
      <Card style={{ gap: space.lg }}>
        <Promise_ icon="smartphone" title="Stays on your phone" body="No account, no server, no analytics. Ebb does not send your diary anywhere." />
        <Promise_ icon="lock" title="Lock it if you like" body="Optional PIN and Face ID. Reminders never reveal details." />
        <Promise_ icon="download" title="Yours to keep" body="Export a backup or delete everything, whenever you want." />
      </Card>
      <View style={{ gap: space.sm }}>
        <Button label="Get started" icon="arrow-right" testID="onboarding-start" onPress={() => setStep(1)} />
        <Button label="I already use Flo or Apple Health" variant="secondary" iconLeft="upload" testID="onboarding-import" onPress={() => setImportOpen(true)} />
      </View>
    </View>,
    <View key="goal" style={{ gap: space.lg }}>
      <Title>What brings you here?</Title>
      <Txt muted>This sets which trackers and predictions are shown first. You can change it any time.</Txt>
      <View style={{ gap: space.sm }}>
        {GOALS.map((g) => (
          <Chip key={g} label={GOAL_LABELS[g]} selected={goal === g} onPress={() => setGoal(g)} testID={`goal-${g}`} style={{ alignSelf: 'flex-start' }} />
        ))}
      </View>
      <Txt size={font.small} muted>{GOAL_HINTS[goal]}</Txt>
      <Txt weight="600">Birth control</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {BC.map((b) => (
          <Chip key={b} label={BIRTH_CONTROL_LABELS[b] ?? b} selected={bc === b} onPress={() => setBc(b)} testID={`bc-${b}`} />
        ))}
      </View>
      <Button label="Continue" icon="arrow-right" testID="onboarding-next-1" onPress={() => setStep(2)} />
    </View>,
    <View key="lengths" style={{ gap: space.lg }}>
      <Title>Typical lengths</Title>
      <Txt muted>{hasImportedPeriods ? 'Your imported history already covers this; these are only used as a fallback.' : 'Rough numbers are fine. Once you have logged a few periods, Ebb uses your own history instead.'}</Txt>
      <Card style={{ gap: space.md }}>
        <Txt weight="600">Cycle length (days)</Txt>
        <Stepper value={cycleLen} onChange={setCycleLen} min={15} max={60} testID="cycle-len" />
        <Txt size={font.small} muted>From the first day of one period to the first day of the next. Most cycles are 21 to 35 days.</Txt>
      </Card>
      <Card style={{ gap: space.md }}>
        <Txt weight="600">Period length (days)</Txt>
        <Stepper value={periodLen} onChange={setPeriodLen} min={1} max={12} testID="period-len" />
      </Card>
      {hasImportedPeriods
        ? <Button label="Finish" icon="check" testID="onboarding-next-2" onPress={() => finish(true)} />
        : <Button label="Continue" icon="arrow-right" testID="onboarding-next-2" onPress={() => setStep(3)} />}
    </View>,
    <View key="last" style={{ gap: space.lg }}>
      <Title>When did your last period start?</Title>
      <Txt muted>Tap the first day. Skip if you are not sure and log it later from the calendar.</Txt>
      <Card>
        <MonthNav
          label={`${MONTHS[md.getMonth()]} ${md.getFullYear()}`}
          onPrev={() => setMonth(addMonths(month, -1))}
          onNext={() => setMonth(addMonths(month, 1))}
        />
        <MonthGrid
          year={md.getFullYear()}
          month0={md.getMonth()}
          model={previewModel}
          logs={{}}
          today={today}
          firstDayOfWeek={settings.firstDayOfWeek}
          selected={lastStart}
          onSelectDay={(d) => { if (d <= today) setLastStart(d); }}
          editing
          editSet={new Set(lastStart ? Array.from({ length: periodLen }, (_, i) => addDays(lastStart, i)) : [])}
        />
      </Card>
      <Button label="Finish" icon="check" disabled={!lastStart} testID="onboarding-finish" onPress={() => finish(false)} />
      <Button label="Skip for now" variant="ghost" testID="onboarding-skip" onPress={() => finish(true)} />
    </View>,
  ];
  const visibleSteps = hasImportedPeriods ? steps.slice(0, 3) : steps;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl, maxWidth: 560, width: '100%', alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: space.xl }}>
        {visibleSteps.map((_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? p.accent : p.border }} />
        ))}
      </View>
      {imported && step === 1 ? (
        <Card style={{ marginBottom: space.lg, backgroundColor: p.accentSoft }} testID="onboarding-imported">
          <Row gap={8}><Icon name="check" size={18} color={p.accent} /><Txt weight="600">Imported {imported.summary.days} days{imported.summary.bleedingDays ? `, ${imported.summary.bleedingDays} with bleeding` : ''}.</Txt></Row>
        </Card>
      ) : null}
      {visibleSteps[step]}
      {step > 0 ? <Button label="Back" variant="ghost" style={{ marginTop: space.md }} onPress={() => setStep(step - 1)} /> : null}
      <ImportSheet
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(b) => { setImported(b); setStep(1); }}
      />
    </ScrollView>
  );
}
