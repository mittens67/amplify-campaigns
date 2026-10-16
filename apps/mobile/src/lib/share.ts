import { Share } from 'react-native';
import * as Linking from 'expo-linking';

export function shareCampaign(c: { id: string; title: string }) {
  const url = Linking.createURL(`/campaign/${c.id}`);
  void Share.share({ message: `“${c.title}” — a reviewed campaign on Amplify. ${url}`, title: c.title });
}
