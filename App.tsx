/**
 * Badski - Yokuş aşağı kayak oyunu
 * Giriş ekranı ve Start Game ile oyun ekranına geçiş
 */

import React, {useState} from 'react';
import {SafeAreaView} from 'react-native';
import EntryScreen from './screens/EntryScreen';
import GameScreen from './screens/GameScreen';

type Screen = 'entry' | 'game';

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('entry');

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#0f172a'}}>
      {screen === 'entry' ? (
        <EntryScreen onStartGame={() => setScreen('game')} />
      ) : (
        <GameScreen />
      )}
    </SafeAreaView>
  );
}

export default App;
