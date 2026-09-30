const { withEntitlementsPlist } = require('@expo/config-plugins');

// Ebb only schedules local notifications. expo-notifications adds the
// remote-push entitlement by default; dropping it keeps the App ID free of a
// capability that App Review would otherwise ask about.
// Keep this plugin FIRST in app.json → plugins: config plugins added later run
// their mods earlier, so being first means this runs after expo-notifications.
module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
