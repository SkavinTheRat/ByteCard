const {
  AndroidConfig,
  withAndroidManifest,
  withAndroidStyles,
} = require('expo/config-plugins');

module.exports = function withForceDarkDisabled(config) {
  const withManifest = withAndroidManifest(config, (configWithManifest) => {
    const application = configWithManifest.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:forceDarkAllowed'] = 'false';
    }
    return configWithManifest;
  });
  return withAndroidStyles(withManifest, (configWithStyles) => {
    const styles = configWithStyles.modResults;
    const appTheme = styles.resources.style?.find(
      (style) => style.$?.name === 'AppTheme',
    );
    if (appTheme) {
      appTheme.$ = { ...appTheme.$, parent: 'Theme.AppCompat.NoActionBar' };
    }
    const parent = { name: 'AppTheme' };
    for (const [name, value] of [
      ['android:windowBackground', '#0A0D13'],
      ['android:windowLightStatusBar', 'false'],
      ['android:windowLightNavigationBar', 'false'],
    ]) {
      AndroidConfig.Styles.assignStylesValue(styles, {
        add: true,
        name,
        value,
        parent,
      });
    }
    return configWithStyles;
  });
};
