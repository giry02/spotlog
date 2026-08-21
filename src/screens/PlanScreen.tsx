import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotlog } from '../context/SpotlogContext';
import { findPlace } from '../data/mockCatalog';
import type { RootTabParamList } from '../navigation/RootTabs';
import { shareTrip } from '../services/tripSharing';
import { colors, radius, shadow } from '../theme';

type Props = BottomTabScreenProps<RootTabParamList, 'Plan'>;

export function PlanScreen({ navigation }: Props) {
  const { draft, savedPlaceIds, createRecommendedDraft, saveDraft } = useSpotlog();
  const [activeDay, setActiveDay] = useState(1);

  if (!draft) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.onboarding}><View style={styles.heroIcon}><Ionicons name="map-outline" size={38} color={colors.primary} /></View><Text style={styles.onboardingTitle}>담은 장소에서 일정이 시작돼요</Text><Text style={styles.onboardingCopy}>Spotlog가 저장한 랜드마크를 먼저 배치하고, 이동 흐름에 맞는 식사와 휴식을 추천해 4박 5일 초안을 만듭니다.</Text><View style={styles.steps}><Text style={styles.step}>1  장소 담기</Text><Text style={styles.step}>2  추천 초안 확인</Text><Text style={styles.step}>3  날짜·시간 편집</Text></View><Pressable onPress={createRecommendedDraft} style={styles.makeButton}><Ionicons name="sparkles" size={18} color="#fff" /><Text style={styles.makeButtonText}>{savedPlaceIds.length ? `${savedPlaceIds.length}곳으로 일정 만들기` : '다낭 추천 일정 먼저 보기'}</Text></Pressable><Text style={styles.disclosure}>현재는 로컬 추천 규칙으로 동작하며 실제 AI와 지도 경로 API는 다음 단계에서 연결합니다.</Text></View>
      </SafeAreaView>
    );
  }

  const handleShare = async () => {
    try {
      await shareTrip(draft);
    } catch {
      Alert.alert('공유할 수 없어요', '잠시 후 다시 시도해 주세요.');
    }
  };

  const handleSave = () => {
    if (saveDraft()) navigation.navigate('Trips');
  };

  const dayItems = draft.items.filter((item) => item.day === activeDay).sort((a, b) => a.time.localeCompare(b.time));
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.planHeader}><Text style={styles.eyebrow}>RECOMMENDED DRAFT</Text><Text style={styles.planTitle}>{draft.title}</Text><Text style={styles.planMeta}>{draft.startDate} – {draft.endDate} · {draft.nights}박 {draft.days}일</Text><View style={styles.notice}><Ionicons name="sparkles" size={18} color={colors.primary} /><Text style={styles.noticeText}>담은 장소를 우선 배치한 초안입니다. 다음 단계에서 날짜와 시간을 직접 바꿀 수 있어요.</Text></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>{Array.from({ length: draft.days }, (_, index) => index + 1).map((day) => <Pressable key={day} onPress={() => setActiveDay(day)} style={[styles.dayTab, activeDay === day && styles.dayTabActive]}><Text style={[styles.dayTabLabel, activeDay === day && styles.dayTabLabelActive]}>DAY {day}</Text><Text style={[styles.dayCount, activeDay === day && styles.dayCountActive]}>{draft.items.filter((item) => item.day === day).length}곳</Text></Pressable>)}</ScrollView>
        <View style={styles.mapPreview}><View style={styles.mapGrid} /><View style={[styles.pin, { left: '26%', top: '54%' }]}><Text style={styles.pinText}>1</Text></View><View style={[styles.pin, { left: '55%', top: '32%' }]}><Text style={styles.pinText}>2</Text></View><View style={[styles.pin, { left: '74%', top: '60%' }]}><Text style={styles.pinText}>3</Text></View><View style={styles.routeLine} /><View style={styles.mapLabel}><Ionicons name="navigate" size={15} color={colors.primary} /><Text style={styles.mapLabelText}>DAY {activeDay} 예상 동선</Text></View></View>
        <View style={styles.timelineHeader}><Text style={styles.timelineTitle}>DAY {activeDay} 일정</Text><Text style={styles.timelineHint}>길게 눌러 순서 변경</Text></View>
        <View style={styles.timeline}>{dayItems.length ? dayItems.map((item, index) => { const place = findPlace(item.placeId); if (!place) return null; return <View key={item.id} style={styles.timelineItem}><View style={styles.timeColumn}><Text style={styles.time}>{item.time}</Text><View style={styles.dot} />{index < dayItems.length - 1 && <View style={styles.line} />}</View><Image source={place.image} style={styles.thumb} contentFit="cover" /><View style={styles.itemBody}><View style={styles.sourceRow}><Text style={[styles.source, item.source === 'SAVED' && styles.sourceSaved]}>{item.source === 'SAVED' ? '내가 담은 장소' : 'Spotlog 추천'}</Text><Ionicons name="reorder-three" size={20} color={colors.muted} /></View><Text style={styles.itemTitle}>{place.name}</Text><Text style={styles.itemMeta}>{place.area} · 약 {place.durationMinutes || 60}분</Text></View></View>; }) : <View style={styles.noItem}><Text style={styles.noItemText}>이 날은 아직 비어 있어요.</Text></View>}</View>
      </ScrollView>
      <View style={styles.planBottom}><Pressable onPress={handleShare} style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="일정 공유"><Text style={styles.secondaryText}>일정 공유</Text></Pressable><Pressable onPress={handleSave} style={styles.saveButton} accessibilityRole="button"><Text style={styles.saveText}>{draft.status === 'SAVED' ? '내 여행에 저장' : '이 초안 저장'}</Text></Pressable></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingBottom: 110 }, onboarding: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' }, heroIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, onboardingTitle: { color: colors.ink, fontSize: 25, lineHeight: 33, fontWeight: '900', textAlign: 'center', marginTop: 20 }, onboardingCopy: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10 }, steps: { width: '100%', backgroundColor: '#fff', borderRadius: radius.md, padding: 16, gap: 10, marginTop: 22 }, step: { color: colors.ink, fontSize: 14, fontWeight: '700' }, makeButton: { marginTop: 18, width: '100%', height: 54, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, makeButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' }, disclosure: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 11 },
  planHeader: { padding: 20, paddingBottom: 14 }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, planTitle: { color: colors.ink, fontSize: 26, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7, marginTop: 5 }, planMeta: { color: colors.muted, fontSize: 13, marginTop: 6 }, notice: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: 13, marginTop: 16 }, noticeText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  dayTabs: { gap: 8, paddingHorizontal: 20, paddingBottom: 14 }, dayTab: { minWidth: 72, borderRadius: radius.sm, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, padding: 11 }, dayTabActive: { backgroundColor: colors.primary, borderColor: colors.primary }, dayTabLabel: { color: colors.ink, fontSize: 12, fontWeight: '900' }, dayTabLabelActive: { color: '#fff' }, dayCount: { color: colors.muted, fontSize: 10, marginTop: 3 }, dayCountActive: { color: 'rgba(255,255,255,0.75)' },
  mapPreview: { height: 172, marginHorizontal: 20, borderRadius: radius.md, backgroundColor: '#EAF4F1', overflow: 'hidden', ...shadow }, mapGrid: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.35, borderWidth: 18, borderColor: '#D5E7E2' }, routeLine: { position: 'absolute', left: '29%', top: '50%', width: '48%', height: 4, backgroundColor: colors.primary, transform: [{ rotate: '-11deg' }] }, pin: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 2 }, pinText: { color: '#fff', fontSize: 11, fontWeight: '900' }, mapLabel: { position: 'absolute', left: 12, top: 12, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, flexDirection: 'row', gap: 5, alignItems: 'center' }, mapLabelText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  timelineHeader: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 11, flexDirection: 'row', justifyContent: 'space-between' }, timelineTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, timelineHint: { color: colors.muted, fontSize: 11 }, timeline: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: radius.md, padding: 14, ...shadow }, timelineItem: { minHeight: 100, flexDirection: 'row' }, timeColumn: { width: 48, alignItems: 'center' }, time: { color: colors.primary, fontSize: 12, fontWeight: '900' }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 8 }, line: { width: 2, flex: 1, backgroundColor: '#DCE4FF', marginTop: 3 }, thumb: { width: 70, height: 70, borderRadius: radius.sm, marginRight: 12 }, itemBody: { flex: 1 }, sourceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, source: { color: colors.accent, fontSize: 9, fontWeight: '900' }, sourceSaved: { color: colors.primary }, itemTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 5 }, itemMeta: { color: colors.muted, fontSize: 11, marginTop: 5 }, noItem: { padding: 24, alignItems: 'center' }, noItemText: { color: colors.muted },
  planBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, padding: 14, flexDirection: 'row', gap: 10 }, secondaryButton: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.ink, fontWeight: '900' }, saveButton: { flex: 1.4, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#fff', fontWeight: '900' },
});
