import { WellbeingInsights } from '../components/WellbeingInsights';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { BarChart, LineChart, PhaseBars } from '../components/Charts';
import { Card, Heading, Legend, Row, ScreenHeader, Txt } from '../components/ui';
import { cToF, phaseFrequencies, recurringPatterns, type Phase } from '../logic/cycles';
import { diffDays, formatShort, MONTHS_SHORT, fromISO } from '../logic/dates';
import { anyLabel } from '../logic/trackers';
import { useStore } from '../state';
import { font, phaseColor, space } from '../theme';

const PHASES: Phase[] = ['period', 'follicular', 'fertile', 'ovulation', 'luteal', 'pms'];

export function InsightsScreen() {
  const { model, logs, today, settings, updateSettings, palette: p } = useStore();
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, 520) - space.lg * 4;
  const s = model.stats;

  const completed = model.cycles.filter((c) => c.length !== undefined);
  const recent = completed.slice(-12);
  const pms = recurringPatterns(model, logs, 'pms');
  const period = recurringPatterns(model, logs, 'period');
  const freqs = useMemo(() => phaseFrequencies(model, logs, today).filter((f) => f.total >= 3).slice(0, 8), [model, logs, today]);

  const bbtPoints = useMemo(() => {
    const cur = model.currentCycle;
    if (!cur) return [];
    return Object.values(logs)
      .filter((l) => l.date >= cur.start && l.date <= today && typeof l.bbt === 'number')
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((l) => ({ x: diffDays(cur.start, l.date) + 1, y: settings.tempUnit === 'c' ? (l.bbt as number) : cToF(l.bbt as number), faded: !!l.bbtDisturbed }));
  }, [model.currentCycle, logs, today, settings.tempUnit]);

  const ovMarker = model.predictions[0]?.ovulation && model.currentCycle
    ? [{ x: diffDays(model.currentCycle.start, model.predictions[0].ovulation) + 1, color: p.ovulation, label: model.predictions[0].ovulationEvidence ? 'ov ✓' : 'ov est.' }]
    : [];

  const stat = (label: string, value: string, id: string) => (
    <View style={{ flex: 1, minWidth: 130 }}>
      <Txt size={font.tiny} muted weight="600" style={{ letterSpacing: 0.5 }}>{label.toUpperCase()}</Txt>
      <Txt serif size={30} testID={id}>{value}</Txt>
    </View>
  );

  const regularity = s.regularity === 'regular' ? 'Regular' : s.regularity === 'somewhat' ? 'Slightly irregular' : s.regularity === 'irregular' ? 'Irregular' : '–';

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} testID="insights-screen">
      <ScreenHeader title="Insights" subtitle="Your patterns over time" />

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          {stat('Avg cycle', s.averageLength ? `${Math.round(s.averageLength * 10) / 10} d` : '–', 'stat-cycle')}
          {stat('Avg period', s.averagePeriodLength ? `${Math.round(s.averagePeriodLength * 10) / 10} d` : '–', 'stat-period')}
          {stat('Regularity', regularity, 'stat-regularity')}
          {stat('Cycles logged', String(s.cycleCount), 'stat-count')}
        </View>
        {s.minLength !== undefined && s.maxLength !== undefined ? (
          <Txt size={font.small} muted style={{ marginTop: space.md }}>
            Recent cycles ranged from {s.minLength} to {s.maxLength} days{s.stdDev !== undefined ? ` (variation ±${s.stdDev.toFixed(1)} days)` : ''}. Predicted length: {model.predictedCycleLength} days. Luteal phase used: {model.lutealLength} days{s.personalLuteal ? ' (from temperature-supported estimates)' : ' (default)'}.
          </Txt>
        ) : (
          <Txt size={font.small} muted style={{ marginTop: space.md }}>Statistics appear after two completed cycles.</Txt>
        )}
      </Card>

      <WellbeingInsights />

      <Card style={{ marginTop: space.lg }}>
        <Heading>Cycle length</Heading>
        <Txt size={font.small} muted style={{ marginBottom: space.sm }}>Last {recent.length} cycles. Dashed line is the predicted length. Grey bars are excluded or outliers.</Txt>
        <BarChart
          values={recent.map((c) => c.length as number)}
          labels={recent.map((c) => MONTHS_SHORT[fromISO(c.start).getMonth()] ?? '')}
          palette={p}
          width={chartW}
          highlight={(i) => !!recent[i]?.excluded || !!recent[i]?.outlier}
          reference={model.predictedCycleLength}
        />
      </Card>

      {model.fertilityEnabled && settings.enabledCategories.includes('bbt') ? (
        <Card style={{ marginTop: space.lg }}>
          <Heading>Basal temperature, this cycle</Heading>
          <Txt size={font.small} muted style={{ marginBottom: space.sm }}>A sustained rise can support an estimate of recent ovulation; it cannot confirm the exact day. Hollow dots are disturbed readings.</Txt>
          <LineChart points={bbtPoints} palette={p} width={chartW} markers={ovMarker} yFormat={(v) => v.toFixed(settings.tempUnit === 'c' ? 1 : 0)} />
        </Card>
      ) : null}

      {(pms.length || period.length) ? (
        <Card style={{ marginTop: space.lg }} testID="insights-patterns">
          <Heading>Your patterns</Heading>
          {pms.length ? (
            <View style={{ marginTop: space.sm }}>
              <Txt size={font.small} weight="600" color={p.pms}>In the five days before a period</Txt>
              {pms.slice(0, 8).map((x) => (
                <Row key={`${x.kind}${x.id}`} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Txt size={font.small}>{anyLabel(x.id)}</Txt>
                  <Txt size={font.small} muted>{x.count} of {x.of} cycles</Txt>
                </Row>
              ))}
            </View>
          ) : null}
          {period.length ? (
            <View style={{ marginTop: space.md }}>
              <Txt size={font.small} weight="600" color={p.period}>During a period</Txt>
              {period.slice(0, 8).map((x) => (
                <Row key={`${x.kind}${x.id}`} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Txt size={font.small}>{anyLabel(x.id)}</Txt>
                  <Txt size={font.small} muted>{x.count} of {x.of} cycles</Txt>
                </Row>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {freqs.length ? (
        <Card style={{ marginTop: space.lg }}>
          <Heading>Symptoms and moods by phase</Heading>
          <Txt size={font.small} muted style={{ marginBottom: space.sm }}>How often each item appears on days you recorded that category. Unlogged categories are unknown.</Txt>
          <Legend items={PHASES.map((ph) => ({ color: phaseColor(p, ph), label: ph === 'pms' ? 'Premenstrual' : ph[0]!.toUpperCase() + ph.slice(1) }))} />
          <View style={{ height: space.md }} />
          <PhaseBars
            palette={p}
            rows={freqs.map((f) => ({
              label: anyLabel(f.id),
              values: PHASES.map((ph) => ({ phase: ph, value: f.byPhase[ph], color: phaseColor(p, ph) })),
            }))}
          />
        </Card>
      ) : null}

      <Card style={{ marginTop: space.lg }}>
        <Heading>Cycle history</Heading>
        <Txt size={font.small} muted style={{ marginBottom: space.sm }}>Tap a cycle to exclude it from predictions, for example after illness, travel or a change in contraception.</Txt>
        {model.cycles.length === 0 ? <Txt muted>No cycles yet.</Txt> : null}
        {[...model.cycles].reverse().map((c) => {
          const excluded = settings.excludedCycles.includes(c.start);
          return (
            <Pressable
              key={c.start}
              testID={`cycle-${c.start}`}
              accessibilityRole="button"
              onPress={() => updateSettings({ excludedCycles: excluded ? settings.excludedCycles.filter((x) => x !== c.start) : [...settings.excludedCycles, c.start] })}
              style={({ pressed }) => ({ paddingVertical: 10, borderTopWidth: 1, borderTopColor: p.border, opacity: pressed ? 0.7 : excluded ? 0.5 : 1 })}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Txt weight="500" style={excluded ? { textDecorationLine: 'line-through' } : undefined}>{formatShort(c.start)}{c.end ? ` – ${formatShort(c.end)}` : ' – ongoing'}</Txt>
                  <Txt size={font.small} muted>
                    Period {c.periodLength} d{c.ovulationEvidence ? ` · ovulation ${formatShort(c.ovulationEvidence.date)} (${c.ovulationEvidence.evidence === 'bbt' ? 'temperature' : c.ovulationEvidence.evidence === 'lh' ? 'LH test' : 'mucus'})` : ''}{c.lutealLength ? ` · luteal ${c.lutealLength} d` : ''}
                  </Txt>
                </View>
                <Txt weight="600" color={c.outlier ? p.textFaint : p.text}>{c.length ? `${c.length} d` : `day ${diffDays(c.start, today) + 1}`}</Txt>
              </Row>
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}
