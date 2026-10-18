import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Open a web link in an in-app browser sheet, so people can check a source and come
 * straight back to the campaign instead of leaving the app. Other schemes (mailto:) and
 * failures fall back to the system handler.
 */
export async function openLink(url: string) {
  if (/^https?:\/\//i.test(url)) {
    try {
      await WebBrowser.openBrowserAsync(url, { toolbarColor: '#FFFFFF', controlsColor: '#4F46E5', showTitle: true });
      return;
    } catch {
      // fall through to the system browser
    }
  }
  await Linking.openURL(url).catch(() => undefined);
}
