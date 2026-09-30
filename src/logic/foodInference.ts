export interface FoodInferenceAvailability { available: boolean; reason?: string }
export async function foodInferenceAvailability(): Promise<FoodInferenceAvailability> {
  return { available: false, reason: 'Photo recognition runs in the Android app. You can still log a meal manually here.' };
}
export async function analyzeMealPhoto(_modelPath: string, _imageUri: string): Promise<string> {
  throw new Error('On-device photo recognition is only available in the Android app.');
}
export async function cancelMealAnalysis(): Promise<void> {}
