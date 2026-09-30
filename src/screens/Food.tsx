import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Platform, ScrollView, View } from 'react-native';
import { Button, Card, Chip, Field, Heading, Row, Sheet, ToggleRow, Txt } from '../components/ui';
import { addDays, formatLong, isValidISO } from '../logic/dates';
import { parseMealSuggestion, validateMealDraft, type MealDraft, type MealEntry } from '../logic/meals';
import { getInstalledModel } from '../logic/modelDownloads';
import { analyzeMealPhoto, cancelMealAnalysis, foodInferenceAvailability } from '../logic/foodInference';
import { discardMealPhoto, pickMealPhoto, retainMealPhoto, deleteSavedMealPhoto, savedMealPhotoURI, mealPhotosSupported, pruneMealPhotos, cleanMealPhotoDrafts, type MealPhoto } from '../logic/mealPhotos';
import { useStore } from '../state';

interface Form {
  dish: string; weight: string; ingredients: { name: string; grams: string }[];
  notes: string; kcal: string; protein: string; fibre: string;
}
const formFor = (draft?: MealDraft): Form => ({ dish: draft?.dish ?? '', weight: String(draft?.weightGrams ?? ''), ingredients: (draft?.ingredients ?? []).map((i) => ({ name: i.name, grams: String(i.grams ?? '') })), notes: draft?.notes ?? '', kcal: String(draft?.nutrition?.kcal ?? ''), protein: String(draft?.nutrition?.proteinGrams ?? ''), fibre: String(draft?.nutrition?.fibreGrams ?? '') });
const number = (text: string) => text.trim() === '' ? undefined : /^\d+(?:[.,]\d+)?$/u.test(text.trim()) ? Number(text.trim().replace(',', '.')) : NaN;
const uniqueId = () => `meal-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
function confirm(title: string, message: string, action: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n${message}`)) action(); }
  else Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: action }]);
}
function MealPhotoView({ file }: { file: string }) {
  const [uri, setURI] = useState<string | null>(null);
  useEffect(() => { let alive = true; void savedMealPhotoURI(file).then((u) => { if (alive) setURI(u); }).catch(() => {}); return () => { alive = false; }; }, [file]);
  return uri ? <Image source={{ uri }} accessibilityLabel="Saved meal photo" style={{ width: '100%', height: 180, borderRadius: 14 }} /> : <Txt size={12} muted>Photo unavailable on this device.</Txt>;
}

export function FoodScreen({ onModels, initialDate }: { onModels: () => void; initialDate?: string }) {
  const { data, settings, updateSettings, saveMeal, removeMeal, today, palette: p } = useStore();
  const [date, setDate] = useState(initialDate && isValidISO(initialDate) && initialDate <= today ? initialDate : today);
  const [review, setReview] = useState<{ id: string; original?: MealEntry; source: 'manual' | 'ai'; model?: 'e2b' | 'e4b' } | null>(null);
  const [form, setForm] = useState<Form>(formFor());
  const [photo, setPhoto] = useState<MealPhoto | null>(null);
  const photoRef = useRef<MealPhoto | null>(null);
  const [keep, setKeep] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nutrition, setNutrition] = useState(false);
  const [cleanupNeeded, setCleanupNeeded] = useState(false);
  const [foodInferenceAvailable, setFoodInferenceAvailable] = useState(false);
  const alive = useRef(true), generation = useRef(0), saving = useRef(false);
  useEffect(() => {
    alive.current = true;
    void foodInferenceAvailability().then((v) => { if (alive.current) setFoodInferenceAvailable(v.available); }).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !saving.current) {
        ++generation.current;
        void cancelMealAnalysis().catch(() => {});
        setBusy('');
      }
    });
    return () => {
      alive.current = false; ++generation.current; sub.remove();
      void cancelMealAnalysis().catch(() => {});
      if (!saving.current && photoRef.current) void discardMealPhoto(photoRef.current).catch(() => {});
    };
  }, []);
  const edit = <K extends keyof Form>(key: K, value: Form[K]) => { setForm((f) => ({ ...f, [key]: value })); setConfirmed(false); };
  const openReview = (entry?: MealEntry) => {
    setReview({ id: entry?.id ?? uniqueId(), original: entry, source: entry?.source ?? 'manual', model: entry?.model });
    setForm(formFor(entry)); setPhoto(null); photoRef.current = null;
    setKeep(entry ? !!entry.photoFile : settings.mealPhotoRetention === 'keep-photo');
    setConfirmed(false); setError(''); setNotice(''); setNutrition(!!entry?.nutrition);
  };
  const close = () => {
    if (saving.current) return;
    ++generation.current;
    void cancelMealAnalysis().catch(() => {});
    const oldPhoto = photoRef.current;
    photoRef.current = null; setPhoto(null); setBusy(''); setReview(null); setError('');
    if (oldPhoto) void discardMealPhoto(oldPhoto).catch(() => {});
  };
  const recognise = async (workingPhoto: MealPhoto) => {
    const token = ++generation.current;
    setBusy('Recognizing on your phone…'); setError(''); setConfirmed(false);
    try {
      if (!foodInferenceAvailable) throw new Error('Local photo recognition is available in the Android build. You can still enter and save this meal yourself.');
      const modelId = settings.foodModelId ?? 'e2b';
      const path = await getInstalledModel(modelId);
      if (!alive.current || token !== generation.current) return;
      if (!path) throw new Error(`Download and select ${modelId.toUpperCase()} in Food AI first, or enter this meal yourself.`);
      const raw = await analyzeMealPhoto(path, workingPhoto.uri);
      if (!alive.current || token !== generation.current) return;
      const parsed = parseMealSuggestion(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setForm(formFor(parsed.draft));
      setReview((r) => r ? { ...r, source: 'ai', model: modelId } : r);
      setNotice('AI suggestions are ready. Please check the dish, portions and ingredients before saving.');
    } catch (e) {
      if (alive.current && token === generation.current) setError(e instanceof Error ? e.message : 'Could not recognize the photo. Enter the details yourself or try again.');
    } finally { if (alive.current && token === generation.current) setBusy(''); }
  };
  const choosePhoto = async (source: 'camera' | 'library') => {
    if (busy) return;
    setBusy('Opening photos…'); setError('');
    try {
      const result = await pickMealPhoto(source);
      if (!alive.current) { if (result) await discardMealPhoto(result); return; }
      if (!result) { setBusy(''); return; }
      openReview(); setPhoto(result); photoRef.current = result;
      await recognise(result);
    } catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : 'Could not open this photo.'); setBusy(''); } }
  };
  const stop = () => {
    ++generation.current; void cancelMealAnalysis().catch(() => {}); setBusy('');
    setNotice('Recognition stopped. You can enter the meal details yourself.');
  };
  const validated = validateMealDraft({ dish: form.dish, weightGrams: number(form.weight), ingredients: form.ingredients.map((i) => ({ name: i.name, grams: number(i.grams) })), notes: form.notes, nutrition: { kcal: number(form.kcal), proteinGrams: number(form.protein), fibreGrams: number(form.fibre) } });
  const save = async () => {
    if (!review || !confirmed || busy || saving.current) return;
    if (!validated.ok) { setError(validated.error); return; }
    saving.current = true; setBusy('Saving meal…'); setError('');
    let addedPhoto: string | undefined;
    const workingPhoto = photoRef.current;
    try {
      const photoFile = keep ? workingPhoto ? (addedPhoto = await retainMealPhoto(workingPhoto)) : review.original?.photoFile : undefined;
      const entry: MealEntry = { ...validated.draft, id: review.id, date, createdAt: review.original?.createdAt ?? new Date().toISOString(), source: review.source, model: review.model, photoFile, userConfirmed: true };
      await saveMeal(entry);
      if (workingPhoto) await discardMealPhoto(workingPhoto).catch(() => setCleanupNeeded(true));
      if (review.original?.photoFile && review.original.photoFile !== photoFile) await deleteSavedMealPhoto(review.original.photoFile).catch(() => setCleanupNeeded(true));
      photoRef.current = null;
      updateSettings({ mealPhotoRetention: keep ? 'keep-photo' : 'data-only' });
      if (alive.current) { setPhoto(null); setReview(null); setNotice('Meal saved.'); }
    } catch (e) {
      if (addedPhoto) await deleteSavedMealPhoto(addedPhoto).catch(() => {});
      if (alive.current) setError(e instanceof Error ? e.message : 'Could not save the meal. Please try again.');
    } finally {
      saving.current = false;
      if (alive.current) setBusy('');
      else if (photoRef.current) { await discardMealPhoto(photoRef.current).catch(() => {}); photoRef.current = null; }
    }
  };
  const erase = (meal: MealEntry) => confirm('Delete meal?', 'Remove this meal and its saved photo from Ebb?', () => {
    setBusy('Deleting meal…');
    void (async () => {
      try { await removeMeal(meal.id); if (meal.photoFile) await deleteSavedMealPhoto(meal.photoFile).catch(() => setCleanupNeeded(true)); setNotice('Meal deleted.'); }
      catch { setError('Could not finish deleting. Please try again.'); }
      finally { if (alive.current) setBusy(''); }
    })();
  });
  const meals = (data.meals ?? []).filter((m) => m.date === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 14 }} testID="food-screen">
      <Txt serif size={34}>Your food diary</Txt>
      <Txt muted size={14}>Meals, in your own words. Photos can help you get started.</Txt>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="‹" small variant="secondary" disabled={!!busy} onPress={() => setDate(addDays(date, -1))} testID="food-prev-day" />
        <Txt size={14} weight="600">{formatLong(date)}</Txt>
        <Button label="›" small variant="secondary" disabled={date >= today || !!busy} onPress={() => setDate(addDays(date, 1))} testID="food-next-day" />
      </Row>
      <Card style={{ gap: 10 }}>
        <Heading>Add a meal</Heading>
        <Button label="Take a photo" disabled={!!busy || !mealPhotosSupported} onPress={() => { void choosePhoto('camera'); }} testID="meal-camera" />
        <Button label="Choose a photo" variant="secondary" disabled={!!busy || !mealPhotosSupported} onPress={() => { void choosePhoto('library'); }} testID="meal-library" />
        <Button label="Enter meal yourself" variant="ghost" disabled={!!busy} onPress={() => openReview()} testID="meal-manual" />
        <Txt size={12} muted>{foodInferenceAvailable ? `Photo recognition runs locally with ${(settings.foodModelId ?? 'e2b').toUpperCase()}. You review every suggestion.` : 'Enter meals here. Photo recognition requires the Android app.'}</Txt>
        <Button label="Choose / manage AI model" variant="ghost" small disabled={!!busy} onPress={onModels} testID="food-model-settings" />
      </Card>
      {!review && error ? <Txt color={p.danger} testID="food-error">{error}</Txt> : null}
      {!review && notice ? <Txt size={14} testID="food-notice">{notice}</Txt> : null}
      {cleanupNeeded ? <Card><Txt size={13}>Your meal details were saved, but a photo copy could not be removed. Please retry cleanup.</Txt><Button label="Retry photo cleanup" variant="secondary" disabled={!!busy} onPress={() => {
        setBusy('Removing unused photos…');
        void pruneMealPhotos((data.meals ?? []).flatMap((m) => m.photoFile ? [m.photoFile] : []))
          .then(() => cleanMealPhotoDrafts()).then(() => setCleanupNeeded(false))
          .catch(() => setError('Photo cleanup failed. Free some storage and try again.'))
          .finally(() => { if (alive.current) setBusy(''); });
      }} /></Card> : null}
      {busy && !review ? <Txt>{busy}</Txt> : null}
      <ToggleRow label="Show calories" hint="Optional. Only values you enter from a label or recipe are shown." value={settings.showMealCalories === true} onChange={(v) => updateSettings({ showMealCalories: v })} testID="meal-show-calories" />
      {!meals.length ? <Card><Heading>A little context for your day</Heading><Txt muted size={14} style={{ marginTop: 8 }}>Add a meal, with or without a photo. Ebb saves only the details you confirm.</Txt></Card> : null}
      {meals.map((meal) => <Card key={meal.id} style={{ gap: 8 }} testID={`meal-entry-${meal.id}`}>
        {meal.photoFile ? <MealPhotoView file={meal.photoFile} /> : null}
        <Heading>{meal.dish}</Heading>
        <Txt size={13} muted>{meal.weightGrams !== undefined ? `Approximately ${meal.weightGrams} g · ` : 'Weight not recorded · '}{meal.photoFile ? 'Photo kept' : 'Data only'}</Txt>
        {meal.ingredients.length ? <Txt size={14}>{meal.ingredients.map((i) => `${i.name}${i.grams !== undefined ? ` (~${i.grams} g)` : ''}`).join(', ')}</Txt> : null}
        {meal.notes ? <Txt muted size={14}>{meal.notes}</Txt> : null}
        {meal.nutrition?.proteinGrams !== undefined ? <Txt size={13}>Protein · {meal.nutrition.proteinGrams} g</Txt> : null}
        {meal.nutrition?.fibreGrams !== undefined ? <Txt size={13}>Fibre · {meal.nutrition.fibreGrams} g</Txt> : null}
        {settings.showMealCalories && meal.nutrition?.kcal !== undefined ? <Txt size={13} testID="meal-calories">Calories · {meal.nutrition.kcal} kcal</Txt> : null}
        <Txt muted size={11}>{meal.source === 'ai' ? 'AI suggestions, reviewed and corrected by you' : 'Entered by you'}. Amounts are estimates.</Txt>
        <Row><Button label="Edit meal" small variant="secondary" disabled={!!busy} onPress={() => openReview(meal)} testID={`meal-edit-${meal.id}`} /><Button label="Delete" small variant="ghost" disabled={!!busy} onPress={() => erase(meal)} testID={`meal-delete-${meal.id}`} /></Row>
      </Card>)}
      <Txt muted size={12}>Meal data is included in JSON backups. Photos stay on this phone and are not included in those backups. Original pictures in your gallery are not changed.</Txt>
    </ScrollView>
    <Sheet visible={!!review} onClose={close} title="Review your meal" closeLabel="Cancel" testID="meal-sheet" footer={<View style={{ padding: 16, borderTopWidth: 1, borderTopColor: p.border }}><Button label={saving.current ? 'Saving…' : 'Confirm & save meal'} disabled={!confirmed || !validated.ok || !!busy} onPress={() => { void save(); }} testID="meal-save" /></View>}>
      <View style={{ gap: 12 }}>
        {photo ? <Image source={{ uri: photo.uri }} accessibilityLabel="Meal photo to review" style={{ width: '100%', height: 190, borderRadius: 16 }} /> : review?.original?.photoFile ? <MealPhotoView file={review.original.photoFile} /> : null}
        <Txt size={13} muted>Check the dish, likely ingredients and approximate weight. Add anything the photo cannot show, such as oil or sauce. Leave amounts blank when unsure.</Txt>
        {busy ? <Card><Txt testID="meal-busy">{busy}</Txt>{!saving.current ? <Button label="Stop recognition" variant="ghost" onPress={stop} testID="meal-stop" /> : null}</Card> : null}
        {error ? <Txt size={14} color={p.danger} testID="meal-error">{error}</Txt> : null}
        {notice ? <Txt size={13}>{notice}</Txt> : null}
        <Field label="Dish" placeholder="e.g. Chickpea curry with rice" value={form.dish} onChangeText={(v) => edit('dish', v)} maxLength={120} editable={!busy} testID="meal-dish" />
        <Field label="Approximate meal weight (g)" placeholder="Leave blank if unknown" value={form.weight} onChangeText={(v) => edit('weight', v)} keyboardType="decimal-pad" editable={!busy} testID="meal-weight" />
        <Heading>Likely ingredients</Heading>
        {form.ingredients.map((item, index) => <Card key={index} style={{ gap: 6 }}>
          <Field label={`Ingredient ${index + 1}`} value={item.name} onChangeText={(v) => edit('ingredients', form.ingredients.map((i, n) => n === index ? { ...i, name: v } : i))} editable={!busy} maxLength={80} testID={`meal-ingredient-${index}`} />
          <Field label="Approximate grams (optional)" value={item.grams} onChangeText={(v) => edit('ingredients', form.ingredients.map((i, n) => n === index ? { ...i, grams: v } : i))} editable={!busy} keyboardType="decimal-pad" testID={`meal-ingredient-grams-${index}`} />
          <Button label="Remove ingredient" variant="ghost" small disabled={!!busy} onPress={() => edit('ingredients', form.ingredients.filter((_, n) => n !== index))} />
        </Card>)}
        <Button label="Add ingredient" variant="secondary" small disabled={!!busy || form.ingredients.length >= 24} onPress={() => edit('ingredients', [...form.ingredients, { name: '', grams: '' }])} testID="meal-add-ingredient" />
        <Field label="Notes (optional)" value={form.notes} onChangeText={(v) => edit('notes', v)} multiline editable={!busy} maxLength={1000} testID="meal-notes" />
        <Button label={nutrition ? 'Hide nutrition fields' : 'Add nutrition from a label or recipe'} variant="ghost" small disabled={!!busy} onPress={() => setNutrition(!nutrition)} testID="meal-nutrition-toggle" />
        {nutrition ? <Card style={{ gap: 8 }}>
          <Txt size={12} muted>Optional values for the whole meal. The AI does not supply these. Unknown amounts stay blank.</Txt>
          <Field label="Protein (g)" value={form.protein} onChangeText={(v) => edit('protein', v)} keyboardType="decimal-pad" editable={!busy} testID="meal-protein" />
          <Field label="Fibre (g)" value={form.fibre} onChangeText={(v) => edit('fibre', v)} keyboardType="decimal-pad" editable={!busy} testID="meal-fibre" />
          {settings.showMealCalories ? <Field label="Calories (kcal)" value={form.kcal} onChangeText={(v) => edit('kcal', v)} keyboardType="decimal-pad" editable={!busy} testID="meal-kcal" /> : <Txt size={12} muted>Calories are hidden. Enable “Show calories” in your food diary to enter them.</Txt>}
        </Card> : null}
        {photo || review?.original?.photoFile ? <Card style={{ gap: 8 }}>
          <Heading>What should Ebb keep?</Heading>
          <Chip label="Data only" selected={!keep} onPress={busy ? undefined : () => setKeep(false)} testID="meal-data-only" />
          <Txt size={12} muted>Save the confirmed meal details and delete Ebb’s photo copy.</Txt>
          <Chip label="Keep photo and data" selected={keep} onPress={busy ? undefined : () => setKeep(true)} testID="meal-keep-photo" />
          <Txt size={12} muted>Uses extra phone storage{photo ? ` · about ${Math.max(1, Math.round(photo.bytes / 1024))} KB for this photo` : ''}. You can remove the photo later by editing this meal.</Txt>
        </Card> : null}
        {photo && !busy && foodInferenceAvailable ? <Button label="Try recognition again" variant="ghost" small onPress={() => { void recognise(photo); }} /> : null}
        {!validated.ok && form.dish ? <Txt size={13} color={p.danger} testID="meal-validation">{validated.error}</Txt> : null}
        <Chip label="I’ve checked these meal details" selected={confirmed} onPress={busy ? undefined : () => setConfirmed(!confirmed)} testID="meal-confirmed" />
        <Txt size={12} muted>Photo suggestions cannot establish exact portions or whether a meal is safe for an allergy.</Txt>
      </View>
    </Sheet>
  </>;
}
