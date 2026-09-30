# Notes for App Review

No account or sign-in is needed. Open the app, tap Get started, choose any options, pick a date for the last period, and every screen is available.

HealthKit: used only on the user's request (Settings → Data → Import from Flo or Apple Health → Read from Apple Health, and Settings → Health → sync sleep and resting heart rate). All reads are on-device; nothing is written to HealthKit and nothing is uploaded. Usage text is in NSHealthShareUsageDescription.

Camera and photo library: used only on the Food tab to attach a photo to a meal entry. Photos stay on the device. On iOS, no photo recognition runs; the user types the meal.

Local notifications: optional reminders configured under Settings → Reminders. No remote push.

Face ID: optional app lock under Settings → Privacy.

Files: "Choose Flo file" opens the system document picker to read a JSON or text export from another cycle app. The file is parsed on-device.

The app is not a medical device and says so in the description and inside the app (Settings → About and the Today screen footer).
