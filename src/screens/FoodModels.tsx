import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import { FOOD_MODELS, modelGB } from '../logic/modelCatalog';
import { modelDownloads } from '../logic/modelDownloads';
import { Button, Card, Heading, Txt } from '../components/ui';
import { useStore } from '../state';

export function FoodModels() {
  const { palette: p, settings, updateSettings } = useStore();
  const [, redraw] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const manager = modelDownloads;
    if (!manager) return;
    let mounted = true;
    const unsubscribe = manager.subscribe(() => redraw((n) => n + 1));
    const refresh = () => { void manager.refresh().catch(() => { if (mounted) setError('Could not read model storage. Reopen this screen to retry.'); }); };
    refresh();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { mounted = false; unsubscribe(); listener.remove(); };
  }, []);
  const attempt = (operation?: Promise<void>) => { setError(''); void operation?.catch(() => setError('Could not complete this operation. Try again.')); };
  return <View style={{ gap: 14 }} testID="food-models">
    <Card style={{ gap: 8 }}>
      <Txt size={12} weight="700" color={p.accent}>FOOD PHOTO · ON YOUR PHONE</Txt>
      <Heading>Choose a local model</Heading>
      <Txt size={14}>Download either model for private meal-photo suggestions, then check the dish, ingredients and portion before saving. Recognition runs on your phone; the model can make mistakes.</Txt>
      {Platform.OS === 'ios' ? <Txt size={14}>Model storage is available on iOS. Photo recognition is currently available in the Android build; iPhone support is still being tested.</Txt> : null}
      <Txt size={13} muted>E2B uses less storage and is the first model to try. E4B is a larger option for a recent phone such as Galaxy S25. Running either model also needs free memory; try E2B if E4B cannot load.</Txt>
      <Txt size={13} muted>Downloads come from Hugging Face over the internet. No diary data or meal photos are sent. Use Wi-Fi. You can use other Ebb screens while downloading; moving Ebb to the background pauses the transfer. Tap Continue when you return. Android can resume an interrupted file; some iOS interruptions may require starting again.</Txt>
      <Txt size={13} muted>Installed models stay in private app storage, outside phone and diary backups. They remain after restarting Ebb or installing an update. Deleting Ebb removes them.</Txt>
      {!modelDownloads ? <Txt size={14} testID="models-native-only">Model downloads are available in the Android and iOS app, not the web preview.</Txt> : null}
    </Card>
    {FOOD_MODELS.map((model) => {
      const state = modelDownloads?.states[model.id];
      const active = state && ['checking', 'downloading', 'verifying'].includes(state.phase);
      const installed = state?.phase === 'downloaded';
      const selected = (settings.foodModelId ?? 'e2b') === model.id;
      return <Card key={model.id} style={{ gap: 10 }} testID={`model-${model.id}`}>
        <Heading>{model.name}</Heading>
        <Txt color={p.accent} weight="600">{modelGB(model.bytes)} download</Txt>
        <Txt muted size={13}>{model.id === 'e2b' ? 'Smaller download; first candidate for lower memory use.' : 'Larger model; compare recognition quality before keeping both.'} Storage size is not working RAM.</Txt>
        <Txt size={13} testID={`model-status-${model.id}`}>{installed ? 'Installed & verified' : active ? `${state.phase === 'checking' ? 'Checking storage' : state.phase === 'verifying' ? 'Verifying file' : 'Downloading'} · ${Math.round(state.progress * 100)}%` : state?.message ?? 'Not downloaded'}</Txt>
        {active ? <Button label="Pause" variant="secondary" onPress={() => attempt(modelDownloads?.cancel())} /> : <>
          {installed ? <Button label={selected ? 'Selected for meal photos' : `Use ${model.id.toUpperCase()} for meal photos`} variant={selected ? 'secondary' : 'primary'} disabled={selected || modelDownloads?.busy} onPress={() => updateSettings({ foodModelId: model.id })} testID={`select-model-${model.id}`} /> : <Button label={state?.phase === 'paused' || state?.phase === 'error' ? `Continue ${model.id.toUpperCase()}` : `Download ${model.id.toUpperCase()} · ${modelGB(model.bytes)}`} disabled={!modelDownloads || modelDownloads.busy} onPress={() => attempt(modelDownloads?.start(model.id))} testID={`download-${model.id}`} />}
          {state && state.phase !== 'missing' ? <Button label="Delete model file" variant="ghost" disabled={modelDownloads?.busy} onPress={() => attempt(modelDownloads?.remove(model.id))} /> : null}
        </>}
        <Button label="Model details & licence ↗" variant="ghost" small onPress={() => { void Linking.openURL(`https://huggingface.co/${model.repo}`).catch(() => setError('Could not open model details. Try again in your browser.')); }} />
      </Card>;
    })}
    {error ? <Txt>{error}</Txt> : null}
  </View>;
}
