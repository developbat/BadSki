/**
 * Oyun config – hız / dönüş açısı, yavaşlama vb.
 * Değerleri buradan değiştirebilirsin.
 */

/** Hız (km/h) aralığı → maksimum dönüş açısı (derece). İbre (accelHold) oranında bu açıya kadar dönersin. */
export const SPEED_TO_MAX_TURN_ANGLE_DEG: { speedMaxKmh: number; maxAngleDeg: number }[] = [
  { speedMaxKmh: 20, maxAngleDeg: 70 },
  { speedMaxKmh: 40, maxAngleDeg: 55 },
  { speedMaxKmh: 60, maxAngleDeg: 40 },
  { speedMaxKmh: 80, maxAngleDeg: 25 },
  { speedMaxKmh: 100, maxAngleDeg: 15 },
  { speedMaxKmh: Infinity, maxAngleDeg: 10 },
];

/** Verilen hız (km/h) için maksimum dönüş açısı (derece). */
export function getMaxTurnAngleDeg(speedKmh: number): number {
  for (const row of SPEED_TO_MAX_TURN_ANGLE_DEG) {
    if (speedKmh <= row.speedMaxKmh) return row.maxAngleDeg;
  }
  return 10;
}
