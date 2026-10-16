import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CampaignView } from '@/features/campaign/CampaignView';
import { useCampaign } from '@/lib/queries';
import { colors, ErrorState, ScreenHeader, Skeleton, space } from '@/ui';

export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useCampaign(id);
  if (q.data) return <CampaignView c={q.data} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader border={false} />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <View style={{ gap: space.md }} accessibilityLabel="Loading campaign">
          <Skeleton height={230} radius={0} />
          <View style={{ padding: space.lg, gap: space.md }}>
            <Skeleton width={110} height={20} />
            <Skeleton width="95%" height={30} />
            <Skeleton width="70%" height={30} />
            <Skeleton width="100%" height={120} radius={16} style={{ marginTop: space.md }} />
          </View>
        </View>
      )}
    </View>
  );
}
