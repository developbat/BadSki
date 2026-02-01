/**
 * Oyun pad'i – Sol | Sağ | (Zıpla ×2 roket üst, Hızlanma alt)
 * Yön ikonları, şeffaf arka plan (sadece butonlar)
 */

import React from 'react';
import {View, Pressable, Text, StyleSheet} from 'react-native';

type Props = {
  onLeft: () => void;
  onLeftRelease: () => void;
  onRight: () => void;
  onRightRelease: () => void;
  onAccel: () => void;
  onAccelRelease: () => void;
  onJumpPress?: () => void;
  onJumpRelease?: () => void;
  leftTilt: number;
  rightTilt: number;
  accelTilt: number;
  disabled: boolean;
};

function GamePad({
  onLeft,
  onLeftRelease,
  onRight,
  onRightRelease,
  onAccel,
  onAccelRelease,
  onJumpPress,
  onJumpRelease,
  leftTilt,
  rightTilt,
  accelTilt,
  disabled,
}: Props): React.JSX.Element {
  const jumpDisabled = disabled || !onJumpPress;
  return (
    <View style={styles.pad} pointerEvents="box-none">
      <View style={styles.padRow}>
        {/* Sol: ← ikonu + ibre */}
        <Pressable
          style={({pressed}) => [
            styles.padButton,
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
          <Text style={styles.padIcon}>←</Text>
        </Pressable>

        {/* Orta: → ikonu + ibre */}
        <Pressable
          style={({pressed}) => [
            styles.padButton,
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
          <Text style={styles.padIcon}>→</Text>
        </Pressable>

        {/* En sağ: üstte zıpla ×2 roket, altta hızlanma */}
        <View style={styles.padRightColumn}>
          {onJumpPress != null ? (
            <Pressable
              style={({pressed}) => [
                styles.padButtonSmall,
                pressed && styles.padButtonPressed,
                jumpDisabled && styles.padButtonDisabled,
              ]}
              onPressIn={onJumpPress}
              onPressOut={onJumpRelease}
              disabled={jumpDisabled}>
              <View style={styles.jumpButtonContent}>
                <Text style={styles.padIcon}>⬆</Text>
                <Text style={styles.padIconSmall}>×2</Text>
                <Text style={styles.padIconSmall}>🚀</Text>
              </View>
            </Pressable>
          ) : null}
          <Pressable
            style={({pressed}) => [
              styles.padButtonSmall,
              pressed && styles.padButtonPressed,
              disabled && styles.padButtonDisabled,
            ]}
            onPressIn={onAccel}
            onPressOut={onAccelRelease}
            disabled={disabled}>
            <View style={styles.tiltBarBg}>
              <View
                style={[styles.tiltBarFill, {height: `${accelTilt * 100}%`}]}
              />
            </View>
            <Text style={styles.padIcon}>⚡</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Entry ekranı arka planı (#0f172a) – şeffaf versiyonu
const PAD_BG = 'rgba(15, 23, 42, 0.55)';

const styles = StyleSheet.create({
  pad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 6,
    backgroundColor: PAD_BG,
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
    gap: 6,
  },
  padButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: PAD_BG,
  },
  padButtonSmall: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: PAD_BG,
  },
  padRightColumn: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  padButtonPressed: {
    opacity: 0.7,
    transform: [{scale: 0.96}],
  },
  padButtonDisabled: {
    opacity: 0.4,
  },
  tiltBarBg: {
    position: 'absolute',
    left: 4,
    top: 6,
    bottom: 6,
    width: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  tiltBarFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 3,
  },
  padIcon: {
    fontSize: 26,
    color: 'rgba(241, 245, 249, 0.95)',
  },
  padIconSmall: {
    fontSize: 11,
    color: 'rgba(241, 245, 249, 0.9)',
  },
  jumpButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});

export default GamePad;
