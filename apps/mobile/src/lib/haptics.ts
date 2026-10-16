import * as Haptics from 'expo-haptics';

type Kind = 'light' | 'medium' | 'success' | 'warning' | 'error' | 'select';

export function haptic(kind: Kind = 'light') {
  try {
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === 'error') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (kind === 'select') void Haptics.selectionAsync();
    else void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics are a nicety; never fail an action because of them.
  }
}
