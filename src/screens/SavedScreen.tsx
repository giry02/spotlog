import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotlog } from '../context/SpotlogContext';
import { places } from '../data/mockCatalog';
import type { RootTabParamList } from '../navigation/RootTabs';
import { colors, radius, shadow } from '../theme';

type Props = BottomTabScreenProps<RootTabParamList, 'Saved'>;

export function SavedScreen({ navigation }: Props) {
  const { savedPlaceIds, toggleSavedPlace, createRecommendedDraft } = useSpotlog();
  const saved = places.filter((place) => savedPlaceIds.includes(place.id));
  const makeTrip = () => { createRecommendedDraft(); navigation.navigate('Plan'); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Text style={styles.eyebrow}>MY SPOTS</Text><Text style={styles.title}>담은 장소</Text><Text style={styles.description}>마음에 든 장면과 장소를 모아두고, 한 번에 여행 일정으로 만들어보세요.</Text></View>
      {saved.length ? (
        <>
          <FlatList contentContainerStyle={styles.list} data={saved} keyExtractor={(item) => item.id} renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={item.image} style={styles.image} contentFit="cover" />
              <View style={styles.cardBody}><Text style={styles.category}>{item.category} · {item.area}</Text><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardCopy} numberOfLines={2}>{item.introduction}</Text><View style={styles.meta}><Ionicons name="time-outline" size={14} color={colors.muted} /><Text style={styles.metaText}>{item.bestTime} · {item.durationMinutes || '숙박'}분</Text></View></View>
              <Pressable onPress={() => toggleSavedPlace(item.id)} style={styles.removeButton} accessibilityLabel={`${item.name} 삭제`}><Ionicons name="bookmark" size={21} color={colors.primary} /></Pressable>
            </View>
          )} />
          <View style={styles.bottomBar}><View><Text style={styles.count}>{saved.length}곳을 담았어요</Text><Text style={styles.hint}>저장한 장소를 먼저 일정에 반영합니다.</Text></View><Pressable onPress={makeTrip} style={styles.primaryButton}><Ionicons name="sparkles" size={17} color="#fff" /><Text style={styles.primaryButtonText}>추천 일정 만들기</Text></Pressable></View>
        </>
      ) : (
        <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="bookmark-outline" size={34} color={colors.primary} /></View><Text style={styles.emptyTitle}>아직 담은 장소가 없어요</Text><Text style={styles.emptyCopy}>발견에서 마음에 드는 장면을 위로 넘겨보세요. 장소 소개를 읽고 북마크를 누르면 여기에 모입니다.</Text><Pressable onPress={() => navigation.navigate('Discover')} style={styles.outlineButton}><Text style={styles.outlineText}>장소 발견하러 가기</Text></Pressable></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 5 }, description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  list: { padding: 16, gap: 12, paddingBottom: 120 }, card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.md, overflow: 'hidden', minHeight: 126, ...shadow }, image: { width: 116 }, cardBody: { flex: 1, padding: 14 }, category: { color: colors.primary, fontSize: 10, fontWeight: '900' }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 4 }, cardCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }, metaText: { color: colors.muted, fontSize: 11 }, removeButton: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, count: { color: colors.ink, fontSize: 14, fontWeight: '900' }, hint: { color: colors.muted, fontSize: 10, marginTop: 2 }, primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 15, height: 48, flexDirection: 'row', alignItems: 'center', gap: 7 }, primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  empty: { flex: 1, paddingHorizontal: 34, alignItems: 'center', justifyContent: 'center' }, emptyIcon: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 18 }, emptyCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }, outlineButton: { marginTop: 20, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: '#fff' }, outlineText: { color: colors.ink, fontWeight: '800' },
});
