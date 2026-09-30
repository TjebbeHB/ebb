import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Button, Chip, ChipGroup, Field, Heading, Row, Sheet, Stepper, ToggleRow, Txt,
} from '../components/ui';
import { cToF, fToC, kgToLb, lbToKg } from '../logic/cycles';
import { addDays, formatLong, formatRelative, type ISODate } from '../logic/dates';
import {
  CATEGORIES, CERVIX_FIRMNESS_OPTIONS, CERVIX_OPENING_OPTIONS, CERVIX_POSITION_OPTIONS,
  ENERGY_OPTIONS, EXERCISE_OPTIONS, FLOW_OPTIONS, LH_OPTIONS, LIBIDO_OPTIONS, MEDICATION_OPTIONS,
  MOOD_OPTIONS, MUCUS_OPTIONS, PILL_OPTIONS, PREGNANCY_OPTIONS, SEX_OPTIONS, SLEEP_QUALITY_OPTIONS,
  SYMPTOM_OPTIONS,
} from '../logic/trackers';
import type { DayLog } from '../logic/types';
import { useStore } from '../state';
import { Icon } from '../components/Icon';
import { font, space } from '../theme';

export function LogDaySheet({
  date, visible, onClose, onChangeDate, onOpenTrackers,
}: {
  date: ISODate;
  visible: boolean;
  onClose: () => void;
  onChangeDate: (d: ISODate) => void;
  onOpenTrackers?: () => void;
}) {
  const { logs, updateLog, toggleListItem, settings, updateSettings, today, palette: p } = useStore();
  const log: DayLog = logs[date] ?? { date };
  const enabled = settings.enabledCategories;
  const [bbtText, setBbtText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [newTag, setNewTag] = useState('');
  const [allSymptoms, setAllSymptoms] = useState(false);
  const [allMoods, setAllMoods] = useState(false);
  const [newSymptom, setNewSymptom] = useState('');

  useEffect(() => {
    setBbtText(log.bbt !== undefined ? (settings.tempUnit === 'c' ? log.bbt.toFixed(2) : cToF(log.bbt).toFixed(2)) : '');
    setWeightText(log.weight !== undefined ? (settings.weightUnit === 'kg' ? log.weight.toFixed(1) : kgToLb(log.weight).toFixed(1)) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, visible]);

  const single = <K extends keyof DayLog>(key: K, id: DayLog[K]) => {
    updateLog(date, { [key]: log[key] === id ? undefined : id } as Partial<DayLog>);
  };

  const commitBbt = () => {
    const n = parseFloat(bbtText.replace(',', '.'));
    if (!Number.isFinite(n)) {
      updateLog(date, { bbt: undefined });
      return;
    }
    const c = settings.tempUnit === 'c' ? n : fToC(n);
    if (c < 34 || c > 42) return;
    updateLog(date, { bbt: Math.round(c * 100) / 100 });
  };

  const commitWeight = () => {
    const n = parseFloat(weightText.replace(',', '.'));
    if (!Number.isFinite(n)) {
      updateLog(date, { weight: undefined });
      return;
    }
    const kg = settings.weightUnit === 'kg' ? n : lbToKg(n);
    if (kg < 20 || kg > 400) return;
    updateLog(date, { weight: Math.round(kg * 10) / 10 });
  };

  const section = (id: string, children: React.ReactNode) => {
    if (!enabled.includes(id)) return null;
    const cat = CATEGORIES.find((c) => c.id === id);
    return (
      <View key={id} style={{ marginBottom: space.md, padding: space.lg, backgroundColor: p.surface, borderRadius: 20 }} testID={`log-section-${id}`}>
        <Heading style={{ marginBottom: 2 }}>{cat?.label ?? id}</Heading>
        {cat?.hint ? <Txt size={font.small} muted style={{ marginBottom: space.sm }}>{cat.hint}</Txt> : <View style={{ height: space.sm }} />}
        {children}
      </View>
    );
  };

  const nav = (delta: number, label: string, id: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onChangeDate(addDays(date, delta))}
      disabled={delta > 0 && date >= today}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: delta > 0 && date >= today ? 0.3 : pressed ? 0.7 : 1 })}
    >
      <Icon name={delta < 0 ? 'chevron-left' : 'chevron-right'} size={18} color={p.text} />
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} testID="log-sheet" footer={<View style={{ padding: 16, borderTopWidth: 1, borderTopColor: p.border }}><Button label="Done" onPress={onClose} testID="log-done" /></View>}>
      <Txt serif size={30} center style={{ marginBottom: 12, letterSpacing: -0.3 }}>{date === today ? 'Log today' : 'Log this day'}</Txt>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.lg }}>
        {nav(-1, 'Previous day', 'log-prev-day')}
        <View style={{ alignItems: 'center' }}>
          <Txt serif size={21} testID="log-date">{formatLong(date)}</Txt>
          <Txt size={font.small} muted>{formatRelative(date, today)}</Txt>
        </View>
        {nav(1, 'Next day', 'log-next-day')}
      </Row>

      {section('flow', (
        <ChipGroup options={FLOW_OPTIONS} selected={log.flow} onToggle={(id) => single('flow', id as DayLog['flow'])} color={p.period} testPrefix="flow" />
      ))}

      {section('moods', (
        <View style={{ gap: 8 }}>
          <ChipGroup options={MOOD_OPTIONS.filter((o) => allMoods || ['calm', 'happy', 'sensitive', 'sad', 'irritable', 'anxious'].includes(o.id) || log.moods?.includes(o.id))} selected={log.moods} onToggle={(id) => toggleListItem(date, 'moods', id)} testPrefix="mood" />
          <Button label={allMoods ? 'Show fewer moods' : 'More moods'} variant="ghost" small onPress={() => setAllMoods(!allMoods)} />
        </View>
      ))}

      {section('energy', (
        <ChipGroup options={ENERGY_OPTIONS} selected={log.energy ? String(log.energy) : undefined} onToggle={(id) => single('energy', Number(id) as DayLog['energy'])} testPrefix="energy" />
      ))}

      {section('symptoms', (
        <View style={{ gap: space.md }}>
          <Chip label="No symptoms" selected={Array.isArray(log.symptoms) && log.symptoms.length === 0} onPress={() => updateLog(date, { symptoms: log.symptoms?.length === 0 ? undefined : [] })} testID="symptom-none" />
          <ChipGroup
            options={[...SYMPTOM_OPTIONS, ...settings.customSymptoms.map((s) => ({ id: s, label: s }))].filter((o, i) => allSymptoms || i < 6 || log.symptoms?.includes(o.id))}
            selected={log.symptoms}
            onToggle={(id) => toggleListItem(date, 'symptoms', id)}
            testPrefix="symptom"
          />
          <Button label={allSymptoms ? "Show fewer symptoms" : "More symptoms"} variant="ghost" small onPress={() => setAllSymptoms(!allSymptoms)} />
          <Row>
            <Field value={newSymptom} onChangeText={setNewSymptom} placeholder="Add your own symptom" style={{ flex: 1 }} testID="new-symptom" />
            <Button
              label="Add"
              small
              variant="secondary"
              disabled={!newSymptom.trim()}
              onPress={() => {
                const s = newSymptom.trim();
                if (!s) return;
                if (!settings.customSymptoms.includes(s)) updateSettings({ customSymptoms: [...settings.customSymptoms, s] });
                toggleListItem(date, 'symptoms', s);
                setNewSymptom('');
              }}
            />
          </Row>
        </View>
      ))}

      {section('pain', (
        <View style={{ gap: 12 }}>
          <Txt size={font.small} muted>How much pain are you in? 0 means none, 10 is the worst.</Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            {Array.from({ length: 11 }, (_, i) => <Chip key={i} label={String(i)} selected={log.pain === i} onPress={() => single('pain', i)} testID={`pain-${i}`} />)}
          </Row>
          <Txt size={font.small} weight="600">Impact on your day</Txt>
          <ChipGroup options={[{ id: 'none', label: 'No impact' }, { id: 'some', label: 'Slowed me down' }, { id: 'missed_activities', label: 'Missed activities' }]} selected={log.dailyImpact} onToggle={(id) => single('dailyImpact', id as DayLog['dailyImpact'])} testPrefix="impact" />
        </View>
      ))}

      {section('sleep', (
        <View style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt muted>Hours</Txt>
            <Stepper value={log.sleepHours ?? 0} onChange={(v) => updateLog(date, { sleepHours: v === 0 ? undefined : v })} min={0} max={16} step={0.5} format={(v) => (v === 0 ? '–' : `${v}h`)} testID="sleep" />
          </Row>
          <ChipGroup options={SLEEP_QUALITY_OPTIONS} selected={log.sleepQuality} onToggle={(id) => single('sleepQuality', id as DayLog['sleepQuality'])} testPrefix="sleepq" />
        </View>
      ))}

      {section('sex', (
        <View style={{ gap: space.md }}>
          <ChipGroup options={SEX_OPTIONS} selected={log.sex} onToggle={(id) => toggleListItem(date, 'sex', id)} testPrefix="sex" />
          <Txt size={font.small} muted>Libido</Txt>
          <ChipGroup options={LIBIDO_OPTIONS} selected={log.libido} onToggle={(id) => single('libido', id as DayLog['libido'])} testPrefix="libido" />
        </View>
      ))}

      {section('discharge', (
        <ChipGroup options={MUCUS_OPTIONS} selected={log.mucus} onToggle={(id) => single('mucus', id as DayLog['mucus'])} color={p.fertile} testPrefix="mucus" />
      ))}

      {section('cervix', (
        <View style={{ gap: space.md }}>
          <Txt size={font.small} muted>Position</Txt>
          <ChipGroup options={CERVIX_POSITION_OPTIONS} selected={log.cervixPosition} onToggle={(id) => single('cervixPosition', id as DayLog['cervixPosition'])} color={p.fertile} />
          <Txt size={font.small} muted>Firmness</Txt>
          <ChipGroup options={CERVIX_FIRMNESS_OPTIONS} selected={log.cervixFirmness} onToggle={(id) => single('cervixFirmness', id as DayLog['cervixFirmness'])} color={p.fertile} />
          <Txt size={font.small} muted>Opening</Txt>
          <ChipGroup options={CERVIX_OPENING_OPTIONS} selected={log.cervixOpening} onToggle={(id) => single('cervixOpening', id as DayLog['cervixOpening'])} color={p.fertile} />
        </View>
      ))}

      {section('bbt', (
        <View style={{ gap: space.sm }}>
          <Row>
            <Field
              value={bbtText}
              onChangeText={setBbtText}
              placeholder={settings.tempUnit === 'c' ? 'e.g. 36.55' : 'e.g. 97.8'}
              keyboardType="decimal-pad"
              style={{ flex: 1 }}
              testID="bbt-input"
            />
            <Txt muted>°{settings.tempUnit.toUpperCase()}</Txt>
            <Button label="Save" small variant="secondary" onPress={commitBbt} testID="bbt-save" />
          </Row>
          {log.bbt !== undefined ? (
            <Txt size={font.small} muted testID="bbt-saved">Saved: {settings.tempUnit === 'c' ? `${log.bbt.toFixed(2)} °C` : `${cToF(log.bbt).toFixed(2)} °F`}</Txt>
          ) : null}
          <ToggleRow label="Disturbed reading" hint="Late night, alcohol, illness or a different time. Ignored for ovulation detection." value={!!log.bbtDisturbed} onChange={(v) => updateLog(date, { bbtDisturbed: v || undefined })} />
        </View>
      ))}

      {section('tests', (
        <View style={{ gap: space.md }}>
          <Txt size={font.small} muted>Ovulation test (LH)</Txt>
          <ChipGroup options={LH_OPTIONS} selected={log.lhTest} onToggle={(id) => single('lhTest', id as DayLog['lhTest'])} color={p.fertile} testPrefix="lh" />
          <Txt size={font.small} muted>Pregnancy test</Txt>
          <ChipGroup options={PREGNANCY_OPTIONS} selected={log.pregnancyTest} onToggle={(id) => single('pregnancyTest', id as DayLog['pregnancyTest'])} testPrefix="preg" />
        </View>
      ))}

      {section('pill', (
        <ChipGroup options={PILL_OPTIONS} selected={log.pill} onToggle={(id) => single('pill', id as DayLog['pill'])} testPrefix="pill" />
      ))}

      {section('medications', (
        <ChipGroup options={MEDICATION_OPTIONS} selected={log.medications} onToggle={(id) => toggleListItem(date, 'medications', id)} testPrefix="med" />
      ))}

      {section('water', (
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt muted>Glasses</Txt>
          <Stepper value={log.water ?? 0} onChange={(v) => updateLog(date, { water: v === 0 ? undefined : v })} min={0} max={20} testID="water" />
        </Row>
      ))}

      {section('exercise', (
        <ChipGroup options={EXERCISE_OPTIONS} selected={log.exercise} onToggle={(id) => toggleListItem(date, 'exercise', id)} testPrefix="exercise" />
      ))}

      {section('weight', (
        <Row>
          <Field value={weightText} onChangeText={setWeightText} placeholder={settings.weightUnit === 'kg' ? 'e.g. 62.5' : 'e.g. 138'} keyboardType="decimal-pad" style={{ flex: 1 }} testID="weight-input" />
          <Txt muted>{settings.weightUnit}</Txt>
          <Button label="Save" small variant="secondary" onPress={commitWeight} />
        </Row>
      ))}

      {section('tags', (
        <View style={{ gap: space.md }}>
          {settings.customTags.length ? (
            <ChipGroup options={settings.customTags.map((t) => ({ id: t, label: t }))} selected={log.tags} onToggle={(id) => toggleListItem(date, 'tags', id)} testPrefix="tag" />
          ) : <Txt size={font.small} muted>No tags yet.</Txt>}
          <Row>
            <Field value={newTag} onChangeText={setNewTag} placeholder="New tag" style={{ flex: 1 }} testID="new-tag" />
            <Button
              label="Add"
              small
              variant="secondary"
              disabled={!newTag.trim()}
              testID="add-tag"
              onPress={() => {
                const t = newTag.trim();
                if (!t) return;
                if (!settings.customTags.includes(t)) updateSettings({ customTags: [...settings.customTags, t] });
                toggleListItem(date, 'tags', t);
                setNewTag('');
              }}
            />
          </Row>
        </View>
      ))}

      {section('notes', (
        <Field value={log.notes ?? ''} onChangeText={(t) => updateLog(date, { notes: t || undefined })} placeholder="Anything else about today" multiline testID="notes-input" />
      ))}

      {onOpenTrackers ? (
        <Chip label="Choose which trackers to show" onPress={() => { onClose(); onOpenTrackers(); }} style={{ alignSelf: 'center' }} testID="log-customise" />
      ) : null}

    </Sheet>
  );
}
