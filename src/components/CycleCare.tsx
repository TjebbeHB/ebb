import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { CARE_GUIDES, CARE_SOURCES, dailyCare, type CareStage } from '../logic/guidance';
import { dayStatus } from '../logic/cycles';
import { useStore } from '../state';
import { Button, Card, Chip, Heading, Sheet, Txt } from './ui';

export function CycleCare() {
  const { today, logs, model, palette: p } = useStore();
  const status = dayStatus(model, logs, today, today);
  const care = dailyCare({ date: today, log: logs[today], phase: status.phase,
    fertilityEnabled: model.fertilityEnabled, hasCycle: !!model.lastPeriod,
    phaseUncertain: (status.late !== undefined && status.late >= 0) || model.stats.regularity === 'irregular',
  });
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<CareStage>('everyday');
  const [linkError, setLinkError] = useState('');
  const guide = CARE_GUIDES[stage];
  return <>
    <Card style={{ marginTop: 20 }} testID="today-care">
      <Txt size={12} color={p.accent} weight="700" style={{ letterSpacing: 1 }}>FOOD & MOVEMENT</Txt>
      <Txt serif size={27} style={{ marginTop: 5 }}>{care.guide.title}</Txt>
      <Txt muted size={12} style={{ marginTop: 4 }}>{care.reason}</Txt>
      <View style={{ gap: 6, marginVertical: 14 }}>
        <Txt weight="600">On your plate</Txt>
        <Txt size={14}>{care.guide.food}</Txt>
        <Txt weight="600" style={{ marginTop: 8 }}>Move in your own way</Txt>
        <Txt size={14} testID="care-today-movement">{care.movement}</Txt>
        {care.caution ? <Txt size={13} color={p.accent}>{care.caution}</Txt> : null}
      </View>
      <Button label="Explore your month  →" variant="secondary" onPress={() => { setStage(care.stage); setOpen(true); }} testID="open-cycle-care" />
    </Card>
    <Sheet visible={open} onClose={() => setOpen(false)} title="Food & movement" testID="cycle-care-sheet">
      <Txt muted size={14}>A flexible guide for the whole month. These are ideas to explore, not a prescribed diet or training plan.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 }}>
        {(Object.keys(CARE_GUIDES) as CareStage[]).map((id) => <Chip key={id} label={CARE_GUIDES[id].label} selected={stage === id} onPress={() => setStage(id)} testID={`care-stage-${id}`} />)}
      </View>
      <Txt size={12} color={p.accent} weight="600">{stage === 'everyday' ? 'EVERYDAY FOUNDATIONS' : 'EXPLORE A PHASE · EDUCATIONAL'}</Txt>
      <Txt serif size={29} testID="care-guide-title">{guide.title}</Txt>
      <Txt muted size={14} style={{ marginTop: 8, marginBottom: 16 }}>{guide.context}</Txt>
      <View style={{ gap: 12 }}>
        <Card>
          <Heading>On your plate</Heading>
          <Txt size={14} style={{ marginVertical: 8 }}>{guide.food}</Txt>
          <Txt weight="600" size={14}>A few meal ideas</Txt>
          {guide.meals.map((meal) => <Txt key={meal} size={14} style={{ marginTop: 8 }}>• {meal}</Txt>)}
          <Txt muted size={12} style={{ marginTop: 12 }}>Swap ingredients to suit your allergies, preferences and medical needs. These meals work in other phases too.</Txt>
        </Card>
        <Card><Heading>Movement & recovery</Heading><Txt size={14} style={{ marginTop: 8 }}>{guide.movement}</Txt><Txt size={14} muted style={{ marginTop: 10 }}>{guide.recovery}</Txt></Card>
        <Card>
          <Heading>Why this advice?</Heading>
          <Txt size={13} muted style={{ marginVertical: 8 }}>Research does not support one workout schedule for everyone based on cycle phase. Ebb uses today’s logged energy, pain, symptoms and sleep quality to offer easier options. It does not infer nutrient deficiencies or calculate workout readiness from hormones.</Txt>
          <Txt size={13} muted>Phase dates are estimates. Hormonal birth control and uncertain dates use everyday guidance. The phase tabs remain available for learning.</Txt>
          {CARE_SOURCES.map((source) => <Button key={source.url} label={`${source.title} ↗`} variant="ghost" small onPress={() => { void Linking.openURL(source.url).catch(() => setLinkError('Could not open the source. Try again when your browser is available.')); }} />)}
          {linkError ? <Txt size={13}>{linkError}</Txt> : null}
          <Txt size={12} muted>Sources reviewed September 2026. Links open in your browser.</Txt>
        </Card>
      </View>
    </Sheet>
  </>;
}
