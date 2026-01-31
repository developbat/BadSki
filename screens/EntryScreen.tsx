/**
 * Giriş ekranı - "Start Game" butonu ile oyuna geçiş
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

type Props = {
  onStartGame: () => void;
};

function EntryScreen({onStartGame}: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={styles.container.backgroundColor} />
      <Text style={styles.title}>Badski</Text>
      <Text style={styles.subtitle}>Yokuş Aşağı Kayak</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={onStartGame}
        activeOpacity={0.8}>
        <Text style={styles.buttonText}>Start Game</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});

export default EntryScreen;
