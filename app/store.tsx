import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '../components/BackHeader';

export default function StoreScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content}>
        <BackHeader title="Store" />
        <View style={styles.body}>
          <Text style={styles.text}>Store coming soon</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000814' },
  content: { flex: 1 },
  body: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 16, color: '#6b7280' },
});
