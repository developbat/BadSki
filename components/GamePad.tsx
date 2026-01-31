/**
 * Oyun pad'i – Sol | Hızlanma | Sağ
 * En altı kaplayan havalı UI, sol/sağ min–max tilt ibresi
 */

import React from 'react';
import {View, Pressable, Text, StyleSheet, Dimensions} from 'react-native';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

type Props = {
  onLeft: () => void;
  onLeftRelease: () => void;
  onCenter: () => void;
  onCenterRelease: () => void;
  onRight: () => void;
  onRightRelease: () => void;
  leftTilt: number;
  rightTilt: number;
  disabled: boolean;
};

function GamePad({
  onLeft,
  onLeftRelease,
  onCenter,
  onCenterRelease,
  onRight,
  onRightRelease,
  leftTilt,
  rightTilt,
  disabled,
}: Props): React.JSX.Element {
  return (
    <View style={styles.pad} pointerEvents="box-none">
      <View style={styles.padRow}>
        <Pressable
          style={({pressed}) => [
            styles.padButton,
            styles.padLeft,
            pressed && styles.padButtonPressed,
            disabled && styles.padButtonDisabled,
          ]}
          onPressIn={onLeft}
          onPressOut={onLeftRelease}
          disabled={disabled}>
          <View style={styles.tiltBarBg}>
            <View
              style={[styles.tiltBarFill, {height: `${leftTilt * 100}%`}]}
            />
          </View>
          <Text style={styles.padButtonText}>Sol</Text>
        </Pressable>

        <Pressable
          style={({pressed}) => [
            styles.padButton,
            styles.padCenter,
            pressed && styles.padButtonPressed,
            disabled && styles.padButtonDisabled,
          ]}
          onPressIn={onCenter}
          onPressOut={onCenterRelease}
          disabled={disabled}>
          <Text style={styles.padButtonText}>Hızlanma</Text>
        </Pressable>

        <Pressable
          style={({pressed}) => [
            styles.padButton,
            styles.padRight,
            pressed && styles.padButtonPressed,
            disabled && styles.padButtonDisabled,
          ]}
          onPressIn={onRight}
          onPressOut={onRightRelease}
          disabled={disabled}>
          <View style={styles.tiltBarBg}>
            <View
              style={[styles.tiltBarFill, {height: `${rightTilt * 100}%`}]}
            />
          </View>
          <Text style={styles.padButtonText}>Sağ</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  padRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    width: '100%',
    gap: 5,
  },
  padButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  padLeft: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  padCenter: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  padRight: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  padButtonPressed: {
    opacity: 0.85,
    transform: [{scale: 0.97}],
  },
  padButtonDisabled: {
    opacity: 0.4,
  },
  tiltBarBg: {
    position: 'absolute',
    left: 4,
    top: 8,
    bottom: 8,
    width: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  tiltBarFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 3,
  },
  padButtonText: {
    color: '#f1f5f9',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default GamePad;
