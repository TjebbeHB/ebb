import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { MEAL_IMAGE_PROMPT } from './meals';
import type { FoodInferenceAvailability } from './foodInference';

interface LocalAiModule {
  isInferenceAvailable(): Promise<boolean>;
  analyzeMealPhoto(modelPath: string, imageUri: string, prompt: string): Promise<string>;
  cancelMealAnalysis(): Promise<void>;
}
const native = requireOptionalNativeModule<LocalAiModule>('EbbLocalAi');
let cancellationGeneration = 0;

export async function foodInferenceAvailability(): Promise<FoodInferenceAvailability> {
  if (Platform.OS !== 'android') return { available: false, reason: 'Photo recognition is ready for Android testing. On iPhone, you can keep a meal diary and add photos manually.' };
  if (!native || !await native.isInferenceAvailable()) return { available: false, reason: 'This build or device cannot run the local photo model. You can still log a meal manually.' };
  return { available: true };
}
export async function analyzeMealPhoto(modelPath: string, imageUri: string): Promise<string> {
  const request = cancellationGeneration;
  const status = await foodInferenceAvailability();
  if (request !== cancellationGeneration) throw new Error('Analysis cancelled.');
  if (!status.available || !native) throw new Error(status.reason || 'Photo recognition is unavailable.');
  return native.analyzeMealPhoto(modelPath, imageUri, MEAL_IMAGE_PROMPT);
}
export async function cancelMealAnalysis(): Promise<void> {
  cancellationGeneration += 1;
  await native?.cancelMealAnalysis();
}
