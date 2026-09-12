import { useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';

type ViewerImage = { id: string; url: string; width: number; height: number };

type Props = {
  images: ViewerImage[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

/**
 * Vizualizare pe tot ecranul, cu swipe intre poze si pinch-to-zoom (nativ,
 * deci doar pe iOS - Android ignora silentios maximumZoomScale pe ScrollView).
 */
export function ImageViewer({ images, initialIndex, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const { width, height } = Dimensions.get('window');

  if (images.length === 0) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(img) => img.id}
          onMomentumScrollEnd={(e) => {
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={styles.page}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Pressable onPress={onClose} style={[styles.page, { width, height }]}>
                <Image
                  source={{ uri: item.url }}
                  style={{ width, aspectRatio: item.height > 0 ? item.width / item.height : 1 }}
                  contentFit="contain"
                />
              </Pressable>
            </ScrollView>
          )}
        />

        <Pressable
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + spacing.md }]}
          accessibilityLabel="Închide"
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>

        {images.length > 1 ? (
          <View pointerEvents="none" style={[styles.counter, { bottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.counterText}>
              {index + 1} / {images.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  counterText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
