/**
 * Skyguy kayakçı hareketleri - assets/skyguy görselleri
 * stand → duruyor, stand-ski → düz hızlanıyor,
 * right-ski → sağa, left-ski → sola,
 * jump → zıplıyor (kayaların üzerinden geçer),
 * clumsy → düşmeden önceki takılma,
 * fall-florr → kayaya çarpınca düştü, fall-florr-back → ağaca çarpınca sırtüstü düştü
 */

export type SkierState =
  | 'stand'
  | 'stand-ski'
  | 'right-ski'
  | 'left-ski'
  | 'jump'
  | 'clumsy'
  | 'fall-florr'
  | 'fall-florr-back';

// left-ski / right-ski dosya adları yer değiştirdi: Sol buton = left-ski, Sağ buton = right-ski (right-ski 1/3 küçük)
export const SKYGUY_IMAGES: Record<SkierState, number> = {
  stand: require('../assets/skyguy/stand.png'),
  'stand-ski': require('../assets/skyguy/stand-ski.png'),
  'right-ski': require('../assets/skyguy/left-ski.png'),
  'left-ski': require('../assets/skyguy/right-ski.png'),
  jump: require('../assets/skyguy/jump.png'),
  clumsy: require('../assets/skyguy/clumsy.png'),
  'fall-florr': require('../assets/skyguy/fall-florr.png'),
  'fall-florr-back': require('../assets/skyguy/fall-florr-back.png'),
};
