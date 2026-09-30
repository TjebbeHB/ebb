const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Health Connect's privacy link must work without onboarding or unlocking Ebb.
module.exports = function withHealthPrivacy(config) {
  config = withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(c.modResults);
    main['intent-filter'] = (main['intent-filter'] || []).filter((f) => !(f.action || []).some((a) => a.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'));
    app.activity = (app.activity || []).filter((a) => a.$['android:name'] !== '.HealthPrivacyActivity');
    app.activity.push({ $: { 'android:name': '.HealthPrivacyActivity', 'android:exported': 'true', 'android:theme': '@android:style/Theme.Material.Light.NoActionBar' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }] }] });
    app['activity-alias'] = (app['activity-alias'] || []).filter((a) => a.$['android:name'] !== 'ViewPermissionUsageActivity');
    app['activity-alias'].push({
      $: { 'android:name': 'ViewPermissionUsageActivity', 'android:exported': 'true', 'android:targetActivity': '.HealthPrivacyActivity', 'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }], category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }] }],
    });
    // A health diary should not be included in Android's automatic cloud backup.
    app.$['android:allowBackup'] = 'false';
    return c;
  });
  return withDangerousMod(config, ['android', async (c) => {
    const pkg = c.android.package;
    const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'HealthPrivacyActivity.kt'), `package ${pkg}
import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.widget.ScrollView
import android.widget.TextView

class HealthPrivacyActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val text = TextView(this).apply {
      text = "Ebb · Health data privacy\\n\\nEbb reads sleep stages and resting heart rate only with your permission, when you choose to sync.\\n\\nPurpose\\nThese measurements provide context for your cycle and wellbeing patterns. They do not diagnose conditions or confirm ovulation.\\n\\nStorage\\nA snapshot of the latest 28 days stays in Ebb on this device. Ebb does not send health data to a server, use it for advertising, or write it back to Health Connect. Manual diary entries take priority.\\n\\nYour choices\\nChoose permissions in Health Connect. Revoke access there at any time. Remove Ebb’s imported copy in Settings → Health, or erase everything in Settings → Data. Revoking system access does not automatically erase a prior local copy.\\n\\nExports\\nIf you choose to export a JSON backup, it includes the local health snapshot. Share or store backups only where you intend."
      textSize = 18f
      setTextColor(Color.rgb(53, 41, 31))
      setBackgroundColor(Color.rgb(255, 248, 233))
      setPadding(32, 64, 32, 48)
    }
    setContentView(ScrollView(this).apply { addView(text) })
  }
}
`);
    return c;
  }]);
};
