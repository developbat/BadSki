/**
 * Düşünce balonu – duruma göre yüz emojileri ve ayarlar.
 * Yeni emoji eklemek için ilgili listeye ekle (örn. EMOTIONS_HAPPY.push('😎')).
 */

export type BubbleMood = 'happy' | 'sad' | 'scared' | 'panic' | 'nervous' | 'skiing' | 'backToNormal';

/** İyi item aldığında */
export const EMOTIONS_HAPPY: string[] = ['😄', '😊', '🥳', '😁'];

/** Kötü item aldığında */
export const EMOTIONS_SAD: string[] = ['😢', '😞', '😭', '😩'];

/** Çok hızlandığında (korku) */
export const EMOTIONS_SCARED: string[] = ['😱', '😨', '🙀', '😰'];

/** Engelin çok yanından geçince (panik) */
export const EMOTIONS_PANIC: string[] = ['😰', '😵', '🤯', '😱'];

/** Sadece kayarken: bunlardan biri ile başlar, normal kayma sırasında da bunlar */
export const EMOTIONS_SKIING: string[] = ['😌', '😊', '🙂', '😎'];

/** Arada tedirgin (rasgele) – mutsuzla karışmasın diye ayrı liste */
export const EMOTIONS_NERVOUS: string[] = ['😟', '😬', '😐', '😅'];

/** Mutsuzluktan normale dönerken: onlardan biri ile devam eder */
export const EMOTIONS_BACK_TO_NORMAL: string[] = ['😌', '😮‍💨', '🙂', '😊'];

/** Duruma göre emoji listesi */
export const EMOTIONS_BY_MOOD: Record<BubbleMood, readonly string[]> = {
  happy: EMOTIONS_HAPPY,
  sad: EMOTIONS_SAD,
  scared: EMOTIONS_SCARED,
  panic: EMOTIONS_PANIC,
  nervous: EMOTIONS_NERVOUS,
  skiing: EMOTIONS_SKIING,
  backToNormal: EMOTIONS_BACK_TO_NORMAL,
};

/**
 * Listeden rastgele bir emoji seçer; ardışık aynı gelmesin diye son seçileni verirsen
 * (liste 2+ elemansa) onu hariç tutar.
 */
export function pickThoughtEmoji(
  arr: readonly string[],
  lastPicked: string | null
): string {
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  const others = lastPicked ? arr.filter((e) => e !== lastPicked) : [...arr];
  return others[Math.floor(Math.random() * others.length)];
}

// —— Düşünce balonu süreleri ve eşikler ——

/** Bu hızın üstünde “korku” emojisi gösterilir */
export const SPEED_SCARED_THRESHOLD = 220;

/** Engel yanından bu mesafeden az geçerse “panik” (px) */
export const CLOSE_CALL_GAP_PX = 55;

/** İyi item sonrası balon süresi (ms) */
export const BUBBLE_GOOD_MS = 2500;

/** Kötü item sonrası balon süresi (ms) */
export const BUBBLE_BAD_MS = 2500;

/** Panik (yanından geçiş) balon süresi (ms) */
export const BUBBLE_PANIC_MS = 2000;

/** Tedirgin balon gösterim süresi (ms) */
export const BUBBLE_NERVOUS_MS = 1500;

/** Tedirgin tekrar çıkabilmesi için bekleme (ms) */
export const BUBBLE_NERVOUS_COOLDOWN_MS = 3500;

/** Normal zamanda tedirgin çıkma olasılığı (0–1) */
export const BUBBLE_NERVOUS_CHANCE = 0.18;

/** Mutsuzluktan normale dönerken balon süresi (ms) */
export const BUBBLE_BACK_TO_NORMAL_MS = 2200;

/** Kayarken emojisi en az bu kadar gösterilir, sonra yenisi seçilebilir (ms) */
export const BUBBLE_SKIING_MIN_MS = 2500;
