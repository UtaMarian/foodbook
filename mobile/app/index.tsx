import { ActivityIndicator, View } from 'react-native';
import { useColors } from '../src/theme';

/** Ecranul de start: gate-ul din _layout muta imediat spre /login sau /(tabs). */
export default function Index() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  );
}
