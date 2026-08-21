import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotlog } from '../context/SpotlogContext';
import type { RootTabParamList } from '../navigation/RootTabs';
import { shareTrip } from '../services/tripSharing';
import { colors, radius, shadow } from '../theme';

type Props = BottomTabScreenProps<RootTabParamList, 'Trips'>;

export function TripsScreen({ navigation }: Props) {
  const { draft, trips, openTrip, duplicateTrip } = useSpotlog();
  const visibleTrips = draft && !trips.some((trip) => trip.id === draft.id) ? [draft, ...trips] : trips;

  const handleShare = async (trip: (typeof visibleTrips)[number]) => {
    try {
      await shareTrip(trip);
    } catch {
      Alert.alert('공유할 수 없어요', '잠시 후 다시 시도해 주세요.');
    }
  };

  const handleOpen = (id: string) => {
    if (openTrip(id) || draft?.id === id) navigation.navigate('Plan');
  };

  const handleDuplicate = (id: string) => {
    if (duplicateTrip(id)) navigation.navigate('Plan');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Text style={styles.eyebrow}>MY JOURNEYS</Text><Text style={styles.title}>내 여행</Text><Text style={styles.copy}>준비 중인 일정과 여행 중 가이드, 다녀온 기록을 한곳에서 관리합니다.</Text></View>
      {visibleTrips.length ? (
        <ScrollView contentContainerStyle={styles.list}>
          {visibleTrips.map((trip) => (
            <View key={trip.id} style={styles.card}>
              <View style={styles.cardTop}><View style={styles.icon}><Ionicons name="map" size={23} color={colors.primary} /></View><View style={styles.cardCopy}><Text style={styles.status}>{trip.status === 'SAVED' ? '저장된 여행' : '작성 중'} · {trip.nights}박 {trip.days}일</Text><Text style={styles.cardTitle}>{trip.title}</Text><Text style={styles.meta}>{trip.startDate} – {trip.endDate} · {trip.items.length}개 장소</Text></View></View>
              <View style={styles.progress}><View style={[styles.progressFill, trip.status === 'SAVED' && styles.progressSaved]} /></View>
              <Text style={styles.progressText}>{trip.status === 'SAVED' ? '내 여행에 안전하게 저장됨' : '저장 전 일정 초안'}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => void handleShare(trip)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`${trip.title} 공유`}><Ionicons name="share-outline" size={19} color={colors.ink} /></Pressable>
                {trip.status === 'SAVED' && <Pressable onPress={() => handleDuplicate(trip.id)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`${trip.title} 복사`}><Ionicons name="copy-outline" size={18} color={colors.ink} /></Pressable>}
                <Pressable onPress={() => handleOpen(trip.id)} style={styles.primary} accessibilityRole="button"><Text style={styles.primaryText}>{trip.status === 'SAVED' ? '일정 열기' : '계속 작성'}</Text></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}><Ionicons name="trail-sign-outline" size={40} color={colors.muted} /><Text style={styles.emptyTitle}>첫 여행을 만들어보세요</Text><Text style={styles.emptyCopy}>발견에서 장면을 담으면 나만의 일정으로 이어집니다.</Text><Pressable onPress={() => navigation.navigate('Plan')} style={styles.emptyButton}><Text style={styles.emptyButtonText}>여행 만들기</Text></Pressable></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, header: { padding: 20 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginTop: 5 }, copy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  list: { padding: 20, paddingTop: 6, paddingBottom: 100, gap: 14 }, card: { padding: 18, borderRadius: radius.lg, backgroundColor: '#fff', ...shadow }, cardTop: { flexDirection: 'row', gap: 13 }, icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1 }, status: { color: colors.primary, fontSize: 10, fontWeight: '900' }, cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 4 }, meta: { color: colors.muted, fontSize: 11, marginTop: 5 },
  progress: { height: 7, borderRadius: 4, backgroundColor: colors.line, marginTop: 20, overflow: 'hidden' }, progressFill: { width: '60%', height: '100%', backgroundColor: colors.accent }, progressSaved: { width: '100%', backgroundColor: colors.primary }, progressText: { color: colors.muted, fontSize: 10, marginTop: 6 }, actions: { flexDirection: 'row', gap: 8, marginTop: 18 }, iconButton: { width: 45, height: 45, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, primary: { flex: 1, height: 45, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }, emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 12 }, emptyCopy: { color: colors.muted, textAlign: 'center', marginTop: 6 }, emptyButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.primary }, emptyButtonText: { color: '#fff', fontWeight: '900' },
});
