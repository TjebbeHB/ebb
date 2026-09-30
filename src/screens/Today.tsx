import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { CycleCare } from '../components/CycleCare';
import { CycleRing } from '../components/CycleRing';
import { Button, Card, Chip, Dot, Heading, IconButton, Row, ScreenHeader, Txt } from '../components/ui';
import { Icon } from '../components/Icon';
import { dayStatus, phaseLabel, recurringPatterns } from '../logic/cycles';
import { DISCLAIMER, phaseInfo } from '../logic/content';
import { diffDays, formatRelative, formatShort } from '../logic/dates';
import { anyLabel } from '../logic/trackers';
import { useStore } from '../state';
import { font, phaseColor, space } from '../theme';

export function TodayScreen({
  onLog, onEditPeriod, onOpenCalendar, onSettings,
}: {
  onLog: () => void;
  onSettings: () => void;
  onEditPeriod: () => void;
  onOpenCalendar: () => void;
}) {
  const { data, model, logs, today, settings, palette: p, updateLog } = useStore();
  const st = dayStatus(model, logs, today, today);
  const log = logs[today];
  const cur = model.predictions[0];
  const hasData = !!model.lastPeriod;
  const info = phaseInfo(st.phase, settings.goal, model.fertilityEnabled);
  const pms = recurringPatterns(model, logs, 'pms');
  const inPeriod = !!model.lastPeriod && model.lastPeriod.days.includes(today);

  let headline = 'Log your last period';
  let sub = 'Then Ebb can show your cycle day and predictions.';
  if (hasData && cur) {
    const toNext = model.nextPeriodStart ? diffDays(today, model.nextPeriodStart) : undefined;
    if (st.late !== undefined && st.late > 0) {
      headline = st.late === 1 ? 'Period 1 day late' : `Period ${st.late} days late`;
      sub = 'Log it when it starts, or check the calendar if a date is wrong.';
    } else if (st.late === 0 && !inPeriod) {
      headline = 'Period expected today';
      sub = 'Tap "Period started" once it does.';
    } else if (inPeriod) {
      const day = diffDays(model.lastPeriod!.start, today) + 1;
      headline = `Period day ${day}`;
      sub = `Usually lasts about ${model.predictedPeriodLength} days.`;
    } else if (st.ovulation) {
      headline = st.ovulationEvidence ? 'Ovulation (estimated)' : 'Estimated ovulation';
      sub = toNext !== undefined ? `Period expected in ${toNext} days.` : '';
    } else if (st.fertile) {
      headline = settings.goal === 'conceive' ? 'High chance of pregnancy' : 'Fertile window';
      sub = cur.ovulation ? `Estimated ovulation ${formatRelative(cur.ovulation, today).toLowerCase()}.` : '';
    } else if (toNext !== undefined) {
      headline = toNext === 1 ? 'Period in 1 day' : `Period in ${toNext} days`;
      sub = model.nextPeriodRange
        ? `Expected between ${formatShort(model.nextPeriodRange.earliest)} and ${formatShort(model.nextPeriodRange.latest)}.`
        : '';
    }
  }

  const confidence = () => {
    const s = model.stats;
    if (s.validCycleCount < 2) return 'Predictions use your typical cycle length until a few cycles are logged.';
    if (s.regularity === 'regular') return `Based on ${s.validCycleCount} cycles. Your cycles are regular, so predictions should be close.`;
    if (s.regularity === 'somewhat') return `Based on ${s.validCycleCount} cycles with some variation. Expect a couple of days either way.`;
    if (s.regularity === 'irregular') return `Based on ${s.validCycleCount} cycles that vary a lot. Treat dates as a rough guide.`;
    return `Based on ${s.validCycleCount} cycles.`;
  };

  const summary: string[] = [];
  if (log) {
    if (log.flow) summary.push(`Bleeding: ${anyLabel(log.flow)}`);
    if (log.symptoms?.length) summary.push(log.symptoms.map(anyLabel).join(', '));
    if (log.moods?.length) summary.push(log.moods.map(anyLabel).join(', '));
    if (log.energy) summary.push(`Energy: ${anyLabel(String(log.energy))}`);
    if (log.pain !== undefined) summary.push(`Pain: ${log.pain}/10`);
    if (log.dailyImpact) summary.push(`Daily impact: ${log.dailyImpact.replaceAll('_', ' ')}`);
    if (log.bbt !== undefined) summary.push(`Temp logged`);
    if (log.mucus) summary.push(`Discharge: ${anyLabel(log.mucus)}`);
    if (log.sex?.length) summary.push(`Sex: ${log.sex.map(anyLabel).join(', ')}`);
    if (log.pill) summary.push(`Pill ${log.pill}`);
    if (log.notes) summary.push(`Note: ${log.notes}`);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} testID="today-screen">
      <ScreenHeader
        wordmark
        subtitle={`${formatRelative(today, today)}, ${formatShort(today)}`}
        title="Your cycle, at a glance"
        right={<IconButton name="sliders" label="Open settings" onPress={onSettings} testID="today-settings" />}
      />

      <View style={{ alignItems: 'center', marginVertical: space.md }}>
        <CycleRing model={model} today={today} palette={p}>
          {hasData && st.cycleDay ? (
            <>
              <Txt size={font.tiny} muted weight="600" style={{ letterSpacing: 1 }}>CYCLE DAY</Txt>
              <Txt serif size={92} style={{ lineHeight: 103, letterSpacing: -5 }} testID="today-cycle-day">{st.cycleDay}</Txt>
              <Row gap={6}>
                <Dot color={phaseColor(p, st.phase)} />
                <Txt size={font.small} weight="600" color={phaseColor(p, st.phase)} testID="today-phase">{phaseLabel(st.phase)}</Txt>
              </Row>
            </>
          ) : (
            <Txt muted center>No period logged yet</Txt>
          )}
        </CycleRing>
      </View>
      <Pressable accessibilityRole="button" onPress={onOpenCalendar} style={{ backgroundColor: p.surface, borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: p.name === 'light' ? '0 1px 2px rgba(53,41,31,0.05), 0 6px 18px rgba(53,41,31,0.05)' : '0 1px 2px rgba(0,0,0,0.25)' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt serif size={25} color={p.accent} testID="today-headline">{headline}</Txt>
            <Txt size={font.small} muted testID="today-sub">{sub}</Txt>
          </View>
          <Icon name="chevron-right" size={22} color={p.textFaint} />
        </Row>
      </Pressable>

      <View style={{ gap: 8 }}>
        <Button label="Log today" icon="arrow-right" testID="log-today" onPress={onLog} />
        {inPeriod ? (
          <Button label="Period ended" variant="secondary" iconLeft="droplet" testID="period-end" onPress={() => updateLog(today, { flow: undefined })} />
        ) : (
          <Button label="Period started" variant="secondary" iconLeft="droplet" testID="period-start" onPress={() => updateLog(today, { flow: 'medium' })} />
        )}
      </View>

      <CycleCare />

      {data.health && Object.values(data.health.days).length ? (() => {
        const recent = Object.values(data.health.days).filter((d) => d.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
        return recent ? <Card style={{ marginTop: 16 }} testID="today-health">
          <Heading>From your health app</Heading>
          <Txt muted size={12}>{formatShort(recent.date)} · imported {formatShort(data.health.syncedAt.slice(0, 10))}</Txt>
          <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {recent.sleepHours !== undefined ? <Txt size={14}>Sleep · {recent.sleepHours.toFixed(1)} h</Txt> : null}
            {recent.restingHeartRate !== undefined ? <Txt size={14}>Resting heart rate · {Math.round(recent.restingHeartRate)} bpm</Txt> : null}
          </Row>
        </Card> : null;
      })() : null}

      {!hasData ? (
        <Card style={{ marginTop: space.lg }}>
          <Txt weight="600">First step</Txt>
          <Txt muted size={font.small} style={{ marginVertical: space.sm }}>Mark the days of your last period on the calendar. One period is enough to start; predictions improve with each one.</Txt>
          <Button label="Mark period days" variant="secondary" small onPress={onEditPeriod} testID="today-mark-period" />
        </Card>
      ) : null}

      {summary.length ? (
        <Card style={{ marginTop: space.lg }} testID="today-summary">
          <Heading>Logged today</Heading>
          <View style={{ gap: 4, marginTop: space.sm }}>
            {summary.map((s, i) => <Txt key={i} size={font.small} muted>{s}</Txt>)}
          </View>
        </Card>
      ) : null}

      {hasData ? (
        <Card style={{ marginTop: space.lg }}>
          <Row gap={6}>
            <Dot color={phaseColor(p, st.phase)} />
            <Heading>{info.title}</Heading>
          </Row>
          <Txt muted size={font.small} style={{ marginTop: space.sm }}>{info.body}</Txt>
        </Card>
      ) : null}

      {pms.length && st.phase !== 'period' ? (
        <Card style={{ marginTop: space.lg }} testID="today-patterns">
          <Heading>Before your period, you often log</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {pms.slice(0, 6).map((x) => (
              <Chip key={`${x.kind}${x.id}`} label={`${anyLabel(x.id)} · ${x.count}/${x.of}`} color={p.pms} />
            ))}
          </View>
        </Card>
      ) : null}

      {hasData && cur ? (
        <Card style={{ marginTop: space.lg }}>
          <Heading>Coming up</Heading>
          <View style={{ gap: 6, marginTop: space.sm }}>
            {model.fertilityEnabled && cur.fertileStart && cur.fertileEnd && cur.fertileEnd >= today ? (
              <Row gap={8}><Dot color={p.fertile} /><Txt size={font.small}>Fertile window {formatShort(cur.fertileStart)} – {formatShort(cur.fertileEnd)}</Txt></Row>
            ) : null}
            {model.fertilityEnabled && cur.ovulation && cur.ovulation >= today ? (
              <Row gap={8}><Dot color={p.ovulation} /><Txt size={font.small}>Ovulation {formatShort(cur.ovulation)}{cur.ovulationEvidence ? ' (from logged signs; estimate)' : ' (estimate)'}</Txt></Row>
            ) : null}
            {model.nextPeriodStart ? (
              <Row gap={8}><Dot color={p.period} /><Txt size={font.small} testID="next-period">Next period {formatShort(model.nextPeriodStart)}{model.nextPeriodRange ? ` (${formatShort(model.nextPeriodRange.earliest)} – ${formatShort(model.nextPeriodRange.latest)})` : ''}</Txt></Row>
            ) : null}
          </View>
          <Txt size={font.tiny} faint style={{ marginTop: space.md }}>{confidence()}</Txt>
          <Button label="Open calendar" variant="ghost" small onPress={onOpenCalendar} style={{ alignSelf: 'flex-start', marginTop: space.sm, paddingHorizontal: 0 }} />
        </Card>
      ) : null}

      <Txt size={font.tiny} faint style={{ marginTop: space.xl }}>{DISCLAIMER}</Txt>
    </ScrollView>
  );
}
