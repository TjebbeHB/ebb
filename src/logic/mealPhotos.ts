export interface MealPhoto { uri: string; bytes: number; file: string }
export const mealPhotosSupported = false;
export async function pickMealPhoto(_source: 'camera' | 'library'): Promise<MealPhoto | null> { throw new Error('Choose or take meal photos in the installed app.'); }
export async function retainMealPhoto(_photo: MealPhoto): Promise<string> { throw new Error('Photo storage is available in the installed app.'); }
export async function discardMealPhoto(_photo: MealPhoto) {}
export async function deleteSavedMealPhoto(_file: string) {}
export async function savedMealPhotoURI(_file: string): Promise<string | null> { return null; }
export async function clearMealPhotos() {}
export async function cleanMealPhotoDrafts() {}

export async function pruneMealPhotos(_referenced: string[]) {}
