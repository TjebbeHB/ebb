import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { MonthGrid, MonthNav } from '../components/Calendar';
import { Button, Card, Heading, Legend, Row, ScreenHeader, Txt } from '../components/ui';
import { dayStatus, phaseLabel } from '../logic/cycles';
import { addMonths, formatLong, fromISO, MONTHS, type ISODate } from '../logic/dates';
import { anyLabel } from '../logic/trackers';
import { useStore } from '../state';
import { font, phaseColor, space } from '../theme';

export function CalendarScreen({
  onLogDay, editing, setEditing, initialMonth,
}: {
  onLogDay: (d: ISODate) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  initialMonth?: ISODate;
}) {
  const { model, logs, today, settings, palette: p, setFlowForDays } = useStore();
  const [month, setMonth] = useState<ISODate>(initialMonth ?? `${today.slice(0, 7)}-01`);
  const [selected, setSelected] = useState<ISODate>(today);
  const [editSet, setEditSet] = useState<Set<ISODate>>(new Set());

  const md = fromISO(month);
  const loggedSet = useMemo(() => new Set(Object.keys(logs).filter((d) => logs[d]?.flow && logs[d]?.flow !== 'spotting')), [logs]);

  const startEdit = () => {
    setEditSet(new Set(loggedSet));
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => {
    const changes: { date: ISODate; flow: 'medium' | undefined }[] = [];
    for (const d of editSet) if (!loggedSet.has(d)) changes.push({ date: d, flow: 'medium' });
    for (const d of loggedSet) if (!editSet.has(d)) changes.push({ date: d, flow: undefined });
    setFlowForDays(changes);
    setEditing(false);
  };

  const onSelect = (d: ISODate) => {
    if (editing) {
      if (d > today) return;
      setEditSet((s) => {
        const n = new Set(s);
        if (n.has(d)) n.delete(d);
        else n.add(d);
        return n;
      });
      return;
    }
    setSelected(d);
  };

  const st = dayStatus(model, logs, selected, today);
  const log = logs[selected];
  const details: string[] = [];
  if (log?.flow) details.push(`Bleeding: ${anyLabel(log.flow)}`);
  if (log?.symptoms?.length) details.push(`Symptoms: ${log.symptoms.map(anyLabel).join(', ')}`);
  if (log?.moods?.length) details.push(`Mood: ${log.moods.map(anyLabel).join(', ')}`);
  if (log?.energy) details.push(`Energy: ${anyLabel(String(log.energy))}`);
  if (log?.sleepHours) details.push(`Sleep: ${log.sleepHours}h${log.sleepQuality ? `, ${anyLabel(log.sleepQuality)}` : ''}`);
  if (log?.mucus) details.push(`Discharge: ${anyLabel(log.mucus)}`);
  if (log?.bbt !== undefined) details.push(`Temperature: ${settings.tempUnit === 'c' ? `${log.bbt.toFixed(2)} °C` : `${(log.bbt * 9 / 5 + 32).toFixed(2)} °F`}${log.bbtDisturbed ? ' (disturbed)' : ''}`);
  if (log?.lhTest) details.push(`Ovulation test: ${anyLabel(log.lhTest)}`);
  if (log?.pregnancyTest) details.push(`Pregnancy test: ${anyLabel(log.pregnancyTest)}`);
  if (log?.sex?.length) details.push(`Sex: ${log.sex.map(anyLabel).join(', ')}${log.libido ? `, libido ${log.libido}` : ''}`);
  if (log?.pill) details.push(`Pill: ${log.pill}`);
  if (log?.medications?.length) details.push(`Medication: ${log.medications.map(anyLabel).join(', ')}`);
  if (log?.exercise?.length) details.push(`Exercise: ${log.exercise.map(anyLabel).join(', ')}`);
  if (log?.water) details.push(`Water: ${log.water} glasses`);
  if (log?.weight !== undefined) details.push(`Weight: ${settings.weightUnit === 'kg' ? `${log.weight.toFixed(1)} kg` : `${(log.weight * 2.2046).toFixed(1)} lb`}`);
  if (log?.tags?.length) details.push(`Tags: ${log.tags.join(', ')}`);
  if (log?.notes) details.push(log.notes);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} testID="calendar-screen">
      <ScreenHeader
        title="Calendar"
        right={editing ? (
          <Row>
            <Button label="Cancel" variant="ghost" small onPress={cancelEdit} testID="edit-cancel" />
            <Button label="Save" small icon="check" onPress={saveEdit} testID="edit-save" />
          </Row>
        ) : (
          <Button label="Edit period days" variant="secondary" small iconLeft="edit" onPress={startEdit} testID="edit-period" />
        )}
      />
      {editing ? (
        <Card style={{ marginBottom: space.md, backgroundColor: p.periodSoft, borderColor: p.period }}>
          <Txt size={font.small}>Tap days to mark or unmark bleeding. Future days cannot be marked. Flow intensity and spotting can be set per day in the log.</Txt>
        </Card>
      ) : null}
      <Card>
        <MonthNav
          label={`${MONTHS[md.getMonth()]} ${md.getFullYear()}`}
          onPrev={() => setMonth(addMonths(month, -1))}
          onNext={() => setMonth(addMonths(month, 1))}
          onToday={() => { setMonth(`${today.slice(0, 7)}-01`); setSelected(today); }}
        />
        <MonthGrid
          year={md.getFullYear()}
          month0={md.getMonth()}
          model={model}
          logs={logs}
          today={today}
          firstDayOfWeek={settings.firstDayOfWeek}
          selected={editing ? undefined : selected}
          onSelectDay={onSelect}
          editing={editing}
          editSet={editSet}
        />
        <View style={{ marginTop: space.md }}>
          <Legend
            items={[
              { color: p.period, label: 'Period' },
              { color: p.periodSoft, label: 'Predicted / spotting' },
              ...(model.fertilityEnabled ? [{ color: p.fertileSoft, label: 'Fertile' }, { color: p.ovulation, label: 'Ovulation' }] : []),
              { color: p.pmsSoft, label: 'Premenstrual' },
              { color: p.accent, label: 'Has entries' },
            ]}
          />
        </View>
      </Card>

      {!editing ? (
        <Card style={{ marginTop: space.lg }} testID="calendar-day-card">
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Heading>{formatLong(selected)}</Heading>
              <Row gap={6}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: phaseColor(p, st.phase) }} />
                <Txt size={font.small} muted testID="calendar-day-phase">
                  {st.cycleDay ? `Cycle day ${st.cycleDay} · ` : ''}{st.predictedPeriod ? 'Predicted period' : phaseLabel(st.phase)}{st.ovulationEvidence ? ' (from logged signs; estimate)' : ''}{st.late ? ` · ${st.late} days late` : ''}
                </Txt>
              </Row>
            </View>
            <Button label={selected > today ? 'Future' : 'Log'} small disabled={selected > today} onPress={() => onLogDay(selected)} testID="calendar-log-day" />
          </Row>
          {details.length ? (
            <View style={{ gap: 4, marginTop: space.md }}>
              {details.map((d, i) => <Txt key={i} size={font.small}>{d}</Txt>)}
            </View>
          ) : (
            <Txt size={font.small} faint style={{ marginTop: space.md }}>{selected > today ? 'Nothing to log yet.' : 'Nothing logged.'}</Txt>
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}
