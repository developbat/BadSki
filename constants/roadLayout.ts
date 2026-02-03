/**
 * Yol düzeni – gerçekçi ölçüler (px).
 * Değerleri buradan değiştirebilirsin; yorumlar bölge sınırlarını açıklar.
 *
 * Koordinat sistemi: soldan 0, sağa artan. Toplam genişlik = LAYOUT_WIDTH_PX.
 */

/** Toplam düzen genişliği (px). Görsel/araba yolu genişliği. */
export const LAYOUT_WIDTH_PX = 893;

/** Sol manzara bölgesi: 0 px — bu değer (px). Bu değerin altında sol manzara. */
export const SCENERY_LEFT_END_PX = 295;

/** Yol sol kenarı (px). Yol bu pikselden başlar. */
export const ROAD_LEFT_PX = 295;

/** Yol sağ kenarı (px). Yol bu piksele kadar. */
export const ROAD_RIGHT_PX = 606;

/** Sağ manzara bölgesi: bu değer (px) — LAYOUT_WIDTH_PX. Bu değerin üstünde sağ manzara. */
export const SCENERY_RIGHT_START_PX = 606;

// —— Türetilmiş değerler (yukarıdakileri değiştirirsen bunlar otomatik uyumlu) ——

/** Yol genişliği (px). ROAD_RIGHT_PX - ROAD_LEFT_PX. */
export const ROAD_WIDTH_PX = ROAD_RIGHT_PX - ROAD_LEFT_PX;

/** Yol merkezi (px). Karakter ve kamera hizası. */
export const ROAD_CENTER_PX = ROAD_LEFT_PX + ROAD_WIDTH_PX / 2;

/** Yol yarı genişliği (px). Merkezden bir yana maksimum kayma hesabı için. */
export const ROAD_HALF_WIDTH_PX = ROAD_WIDTH_PX / 2;
