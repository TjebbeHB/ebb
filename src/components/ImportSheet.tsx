import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { pickImportText } from '../logic/exportImport';
import { parseFloExport } from '../logic/floImport';
import { healthImportAvailable, importFromAppleHealth } from '../logic/healthImport';
import type { ImportBundle } from '../logic/importMerge';
import { formatMedium } from '../logic/dates';
import { useStore } from '../state';
import { font, space } from '../theme';
import { Icon, type IconName } from './Icon';
import { Button, Card, Heading, Row, Sheet, Txt } from './ui';

function Step({ n, text }: { n: number; text: string }) {
  const { palette: p } = useStore();
  return (
    <Row gap={10} align="flex-start">
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Txt size={font.tiny} weight="700" color={p.accent}>{n}</Txt>
      </View>
      <Txt size={font.small} style={{ flex: 1 }}>{text}</Txt>
    </Row>
  );
}

function Option({ icon, title, body, action, onPress, disabled, testID }: { icon: IconName; title: string; body: string; action: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const { palette: p } = useStore();
  return (
    <Card style={{ gap: space.sm, opacity: disabled ? 0.55 : 1 }}>
      <Row gap={10}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={p.accent} />
        </View>
        <Heading>{title}</Heading>
      </Row>
      <Txt size={font.small} muted>{body}</Txt>
      <Button label={action} variant="secondary" onPress={onPress} disabled={disabled} testID={testID} />
    </Card>
  );
}

/**
 * Lets the user bring history from Flo (export file) or Apple Health into
 * the diary. Shows a preview first; nothing is written until confirmed.
 */
export function ImportSheet({ visible, onClose, onImported }: { visible: boolean; onClose: () => void; onImported?: (bundle: ImportBundle) => void }) {
  const { importBundle, palette: p } = useStore();
  const [health, setHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportBundle | null>(null);
  const [showFloHelp, setShowFloHelp] = useState(false);

  useEffect(() => {
    void healthImportAvailable().then(setHealth);
  }, []);

  useEffect(() => {
    if (!visible) {
      setPreview(null);
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const pickFlo = async () => {
    setError(null);
    setBusy(true);
    try {
      const text = await pickImportText();
      if (text) setPreview(parseFloExport(text));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const readHealth = async () => {
    setError(null);
    setBusy(true);
    try {
      setPreview(await importFromAppleHealth());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!preview) return;
    importBundle(preview);
    onImported?.(preview);
    setPreview(null);
    onClose();
  };

  const s = preview?.summary;
  return (
    <Sheet visible={visible} onClose={onClose} title="Import your history" testID="import-sheet">
      {!preview ? (
        <View style={{ gap: space.md }}>
          <Txt size={font.small} muted>Imported days are added to your diary. Anything you already logged by hand is kept; lists such as symptoms are combined.</Txt>
          <Option
            icon="file"
            title="Flo export file"
            body="Flo emails you a zip with a JSON (or text) file when you ask for your data. Pick that file here."
            action={busy ? 'Reading…' : 'Choose Flo file'}
            onPress={() => { void pickFlo(); }}
            disabled={busy}
            testID="import-flo-file"
          />
          <Button label={showFloHelp ? 'Hide the steps' : 'How do I get my Flo file?'} variant="ghost" small onPress={() => setShowFloHelp(!showFloHelp)} testID="import-flo-help" />
          {showFloHelp ? (
            <Card style={{ gap: 10 }}>
              <Step n={1} text="In Flo, tap your profile picture, then Help (or Settings → Help)." />
              <Step n={2} text="Tap Contact us and ask for “a copy of my data in JSON format”. Flo needs a registered account; Anonymous Mode has to be off." />
              <Step n={3} text="Flo emails a password-protected zip within a few days. Save the password from the message." />
              <Step n={4} text="Open the zip in the Files app (long-press → Uncompress), then choose the .json file above." />
              <Txt size={font.tiny} faint>Quicker alternative on iPhone: turn on Flo → Settings → Apple Health, then use the Apple Health option below. Only what Flo shared with Health comes across.</Txt>
            </Card>
          ) : null}
          <Option
            icon="heart"
            title="Apple Health"
            body={health
              ? 'Reads periods, spotting, discharge, tests, symptoms and basal temperature that Flo, Clue or Apple Cycle Tracking saved to Health. Read-only.'
              : Platform.OS === 'ios'
                ? 'Available in the installed iPhone app.'
                : 'Available on iPhone. On Android, use a Flo file or an Ebb backup.'}
            action={busy ? 'Reading…' : 'Read from Apple Health'}
            onPress={() => { void readHealth(); }}
            disabled={!health || busy}
            testID="import-apple-health"
          />
          {error ? (
            <Card style={{ backgroundColor: p.periodSoft }}>
              <Txt size={font.small} testID="import-error">{error}</Txt>
            </Card>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: space.md }} testID="import-preview">
          <Card style={{ gap: 6 }}>
            <Txt size={font.tiny} weight="700" color={p.accent} style={{ letterSpacing: 1 }}>{s?.source === 'flo' ? 'FROM FLO' : 'FROM APPLE HEALTH'}</Txt>
            <Heading>Ready to add</Heading>
            <Row style={{ flexWrap: 'wrap', gap: space.lg, marginTop: 4 }}>
              <View><Txt serif size={28}>{s?.days ?? 0}</Txt><Txt size={font.tiny} muted>days</Txt></View>
              <View><Txt serif size={28}>{s?.bleedingDays ?? 0}</Txt><Txt size={font.tiny} muted>bleeding days</Txt></View>
              <View><Txt serif size={28}>{s?.events ?? 0}</Txt><Txt size={font.tiny} muted>entries</Txt></View>
            </Row>
            {s?.firstDate && s.lastDate ? <Txt size={font.small} muted>{formatMedium(s.firstDate)} – {formatMedium(s.lastDate)}</Txt> : null}
            {s?.unmapped.length ? (
              <Txt size={font.small} muted>Kept as custom symptoms: {s.unmapped.slice(0, 12).join(', ')}{s.unmapped.length > 12 ? ` and ${s.unmapped.length - 12} more` : ''}.</Txt>
            ) : null}
            {s?.skipped.length ? (
              <Txt size={font.small} muted>Not imported: {s.skipped.join(', ').toLowerCase()}.</Txt>
            ) : null}
          </Card>
          <Button label="Add to my diary" icon="check" onPress={confirm} testID="import-confirm" />
          <Button label="Cancel" variant="ghost" onPress={() => setPreview(null)} testID="import-cancel" />
        </View>
      )}
    </Sheet>
  );
}
