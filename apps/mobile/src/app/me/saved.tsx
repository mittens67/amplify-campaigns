import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark } from 'lucide-react-native';
import { CampaignCard } from '@/features/campaign/CampaignCard';
import { useSaved } from '@/lib/queries';
import { CardSkeleton, colors, EmptyState, ErrorState, ScreenHeader, space } from '@/ui';

export default function Saved() {
  const router = useRouter();
  const q = useSaved();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Saved campaigns" />
      {q.isPending ? (
        <View style={{ padding: space.lg }}>
          <CardSkeleton />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}
          renderItem={({ item }) => <CampaignCard c={item} />}
          ListEmptyComponent={<EmptyState icon={Bookmark} title="Nothing saved yet" body="Tap the bookmark on any campaign to come back to it later." action="Explore campaigns" onAction={() => router.push('/explore')} />}
        />
      )}
    </View>
  );
}
