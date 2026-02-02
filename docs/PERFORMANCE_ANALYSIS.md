# Performans Analizi – En Çok Etkileyen Faktör

## Özet: En büyük darboğaz

**Oyun döngüsü içinde sıkça yapılan `setState` (özellikle `setSpawns`) → tüm GameScreen + tüm spawn çocuklarının her seferinde yeniden render edilmesi.**

- Oyun döngüsü **requestAnimationFrame** ile ~60 FPS çalışıyor.
- Döngü içinde **setScore** (~200 ms’de bir), **setSpawns** (scroll wrap, yeni spawn, boundary spawn, filtre) sıkça çağrılıyor.
- Her **setSpawns** veya **setScore** → React **tüm GameScreen**’i yeniden render ediyor.
- GameScreen’de **spawns.map** ile **tüm** spawn’lar (engel + item) tek tek component olarak çiziliyor (ObstacleView veya View+Text).
- Ayrıca **25 kar parçacığı** (Animated.View) ve MiniMap, paneller, butonlar da aynı ağaçta.

Sonuç: Saniyede çok sayıda tam sayfa re-render + onlarca spawn + 25 particle node’unun reconcile edilmesi → **JS thread ve layout/paint maliyeti** en çok buradan geliyor.

---

## Döngüdeki setState kullanımı (GameScreen.tsx)

| Ne zaman | setState | Tahmini sıklık |
|----------|----------|-----------------|
| Scroll wrap (segment dolunca) | setSpawns(shifted) | ~her 1–3 saniye |
| Yeni engel/item spawn | setSpawns(next) | Her SPAWN_INTERVAL_PX scroll’da |
| Kar sınırı spawn | setSpawns(next) | Her BOUNDARY_SPAWN_INTERVAL_PX’te |
| Ekrandan çıkanları temizleme | setSpawns(stillVisible) | Sık (her frame’de filter, uzunluk değişince setState) |
| Puan artışı | setScore(prev => …) | Her ~200 ms |
| Hız/speed boost bitişi | setSpeed(…) | Seyrek |

Özellikle **setSpawns** hem sık tetikleniyor hem de **spawns** listesi büyüdükçe (20–60+ eleman) her güncellemede büyük bir component ağacı yeniden işleniyor.

---

## Diğer maliyetler (görece daha az)

1. **Her frame 25 parçacık:** `particleAnims[i].x.setValue` / `setValue(y)` → 50 Animated setValue/frame. Native driver ile çoğu iş native tarafta ama yine de JS’te 50 setValue çağrısı var.
2. **freeSkiPathPoints useMemo:** `distanceTraveledMeters` her ~400 ms güncelleniyor; `getProceduralPathPoints(…, 100, …)` ile 50–80 nokta hesaplanıyor. Tek seferlik hesaplama makul, asıl maliyet re-render değil.
3. **Çarpışma döngüsü:** `spawnsRef.current` üzerinde for döngüsü – O(spawn sayısı), ref üzerinde olduğu için re-render tetiklemiyor; mantıklı.

---

## Önerilen odak: Re-render sayısını azaltmak

1. **Spawn güncellemelerini toplu / seyrek yap**
   - Spawn listesini döngüde sadece **ref**’te güncelle; state’e yazmayı **ör. 100–150 ms’de bir** veya “biriken değişiklik varsa” tek bir setSpawns ile yap.
   - Böylece saniyede 5–10 setSpawns yerine 1–2 setSpawns hedeflenir.

2. **Sadece ekranda görünen spawn’ları render et**
   - `spawns` state’i tam kalsın (fizik/çarpışma için), render için ayrı bir `visibleSpawns = spawns.filter(s => … viewport …)` kullan.
   - Görünür olmayanları hiç DOM’a vermeyerek reconciliation maliyetini düşürürsün.

3. **Puan güncellemesini seyrelt**
   - setScore’u 200 ms yerine 300–400 ms’de bir yapmak veya sadece “puan değişti” bayrağı + tek setScore ile güncellemek re-render sayısını azaltır.

4. **İsteğe bağlı: Spawn listesini alt component’e böl**
   - Spawn listesini `React.memo`’lu bir alt component’e verip, sadece `spawns` (ve gerekirse scroll/offset) değişince render olmasını sağlamak; böylece üst panel/UI güncellemeleri spawn ağacını gereksiz yere tetiklemez.

---

## Sonuç

En büyük kazanç: **Oyun döngüsündeki setState (özellikle setSpawns) sıklığını düşürmek ve mümkünse sadece görünür spawn’ları render etmek.**  
Önce bu ikisi uygulanıp FPS / frame süresi ölçülürse, gerekirse parçacık sayısı veya path hesaplama gibi diğer noktalara inilebilir.
