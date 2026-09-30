import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Card, Heading, Row, Txt } from '../components/ui';
import { openHealthSettings, syncWearables, wearableStatus, type WearableStatus } from '../logic/wearables';
import { useStore } from '../state';

export function HealthConnections() {
  const { data, setHealth, palette: p } = useStore();
  const [status, setStatus] = useState<WearableStatus>();
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { mounted.current = true; void wearableStatus().then((s) => { if (mounted.current) setStatus(s); }); return () => { mounted.current = false; }; }, []);
  const sync = async () => {
    setBusy(true); setMessage('');
    try {
      const health = await syncWearables();
      if (!mounted.current) return;
      const count = Object.keys(health.days).length;
      // Replace the snapshot, including empty results, so revoked/deleted data
      // within this window does not remain indefinitely in the local import.
      setHealth(health);
      setMessage(count ? `Imported ${count} days. Your manual entries take priority.` : 'No readable data returned. Check permissions and your wearable’s companion app, then sync again. Apple Health does not disclose read-permission denial.');
    } catch { if (mounted.current) setMessage('Could not read health data. Check permissions and that your health app is available, then try again. Your previous import has not changed.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <View style={{ gap: 16 }} testID="health-connections">
    <Card style={{ gap: 12 }}>
      <Txt size={12} color={p.accent} weight="600" style={{ letterSpacing: 2 }}>YOUR BODY, MORE CONTEXT</Txt>
      <Heading>{status?.provider ?? 'Health connections'}</Heading>
      <Txt muted>{status?.message ?? 'Checking this device…'}</Txt>
      <Row style={{ flexWrap: 'wrap', gap: 8 }}><Txt size={14}>◷ Sleep</Txt><Txt size={14}>♡ Resting heart rate</Txt></Row>
      <Txt muted size={14}>You choose what to share in the system permission screen. Ebb reads the latest 28 days only when you tap sync. It never writes to your health app or sends this data to a server.</Txt>
      <Button label={busy ? 'Reading health data…' : data.health ? 'Sync latest data' : 'Choose permissions & sync'} disabled={busy || !status?.available} onPress={() => void sync()} testID="health-sync" />
      {status?.available && Platform.OS !== 'web' ? <Button label="Manage health permissions" variant="secondary" disabled={busy} onPress={() => { void openHealthSettings().catch(() => setMessage('Open your health app and find Ebb under app permissions.')); }} /> : null}
      {message ? <Txt size={14} testID="health-message">{message}</Txt> : null}
    </Card>
    {data.health ? <Card style={{ gap: 12 }}>
      <Heading>Your local import</Heading>
      <Txt muted size={14}>{Object.keys(data.health.days).length} days · last read {new Date(data.health.syncedAt).toLocaleString()}</Txt>
      <Txt muted size={14}>Sleep is counted from recorded asleep stages and assigned to the day you wake up. Overlapping sleep records are counted once; missing stages stay unknown. Resting heart rate uses the daily median. Device estimates may differ.</Txt>
      <Button label="Remove imported data" variant="secondary" disabled={busy} onPress={() => { setHealth(undefined); setMessage('Imported data removed from Ebb. Revoke system access in your health app if you no longer want to share.'); }} testID="health-remove" />
    </Card> : null}
    <Card style={{ gap: 10 }}>
      <Heading>Which devices work?</Heading>
      <Txt size={14} muted>Android: Wear OS watches and wristbands whose companion apps write sleep stages or resting heart rate to Health Connect.</Txt>
      <Txt size={14} muted>iPhone: Apple Watch and wristbands whose companion apps write these measurements to Apple Health.</Txt>
      <Txt size={14} muted>Available measurements depend on your device and sharing settings. Ebb connects through your phone’s health app; it does not pair directly over Bluetooth. Imported measurements provide context, not a diagnosis or confirmation of ovulation.</Txt>
    </Card>
  </View>;
}
