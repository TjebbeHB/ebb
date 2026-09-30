import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Heading, Row, Txt } from './ui';
import { appointmentSummary, patternText, predictionReview, wellbeingPatterns } from '../logic/wellbeing';
import { exportText } from '../logic/exportImport';
import { useStore } from '../state';

export function WellbeingInsights() {
  const { data, model, logs, today, palette: p } = useStore();
  const review = predictionReview(model);
  const patterns = wellbeingPatterns(model, logs, today, data.health);
  const [report, setReport] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <View style={{ gap: 16, marginTop: 16 }}>
    <Card style={{ gap: 10 }} testID="prediction-review">
      <Txt size={12} color={p.accent} weight="600" style={{ letterSpacing: 1.5 }}>GETTING TO KNOW YOU</Txt>
      <Heading>How close were the estimates?</Heading>
      {review.count >= 3 ? <>
        <Row style={{ alignItems: 'baseline' }}><Txt serif size={36}>{review.averageError!.toFixed(1)}</Txt><Txt muted>days off, on average</Txt></Row>
        <Txt size={14} muted>In {review.withinTwo} of {review.count} retrospective checks, cycle length was within 2 days of the estimate.</Txt>
      </> : <Txt muted size={14}>Log at least five completed cycles to see how the cycle-length rule would have performed on your history. {review.count} of 3 minimum checks available.</Txt>}
      <Txt size={12} muted>Each check uses only cycles before the one being estimated. Excluded cycles are omitted. This reviews the calendar rule, not past delivered predictions or future accuracy.</Txt>
    </Card>
    <Card style={{ gap: 12 }} testID="wellbeing-patterns">
      <Heading>Your everyday patterns</Heading>
      {patterns.length ? patterns.map((p, i) => <View key={`${p.metric}-${p.phase}`} style={{ gap: 4 }}>
        <Txt weight="600" size={14}>{patternText(p)}</Txt>
        <Txt muted size={12}>{p.days} days across {p.cycles} cycles; {p.otherDays} comparison days.</Txt>
      </View>) : <Txt muted size={14}>{model.fertilityEnabled ? 'Log sleep, energy or pain across at least two completed cycles. Ebb needs five observations in a phase and five on other days before showing a difference.' : 'Phase comparisons are off while hormonal contraception is selected. Your logs and health data remain available.'}</Txt>}
      <Txt muted size={12}>Personal observations, not cause and effect. Phases are estimated; missing entries are unknown. Each cycle has equal weight. Manual sleep entries take priority over imports.</Txt>
    </Card>
    <Card style={{ gap: 12 }}>
      <Heading>Make your next appointment easier</Heading>
      <Txt muted size={14}>A 90-day summary of recorded bleeding, symptoms, pain and daily impact. Review it before saving or sharing.</Txt>
      <Button label={report ? 'Hide summary' : 'Preview appointment summary'} variant="secondary" onPress={() => setReport(!report)} testID="report-preview" />
      {report ? <>
        <Txt size={14} testID="appointment-summary">{appointmentSummary(data, model, today)}</Txt>
        <Button label={busy ? 'Preparing…' : 'Save or share summary'} disabled={busy} testID="report-export" onPress={() => {
          setBusy(true);
          void exportText(`ebb-appointment-${today}.txt`, appointmentSummary(data, model, today), 'text/plain').then((r) => setMessage(r.message)).finally(() => setBusy(false));
        }} />
      </> : null}
      {message ? <Txt size={14}>{message}</Txt> : null}
    </Card>
  </View>;
}
