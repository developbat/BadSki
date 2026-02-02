# Curved Track System

This skiing game uses a **pre-generated curved path**, not a straight endless road. The map is a winding line (spline/curve) that turns left and right over distance. All gameplay is driven by this single curve.

## Design Principles

1. **Map generated BEFORE the game starts**  
   - **Mission mode:** When the player taps "Get Mission", a mission is created with a fixed path: `generatePathSegments(theme, targetMeters)` → `pathSegmentsToPoints(segments)` → `mission.points: PathPoint[]`. Each point has `distanceMeters` and `xPx` (horizontal offset of path center).  
   - **Free ski:** A procedural path (sine waves) is used; the same APIs (`getProceduralPathCenterWorldX`, `getTrackBoundsAtScroll`) drive camera, boundaries, and spawns.

2. **Track = winding line**  
   - The path center moves left/right with distance. The road is a band of fixed half-width around this center: `[centerX - halfWidth, centerX + halfWidth]`.  
   - Half-width is slightly narrower than full screen so turns are visible and matter: `getTrackHalfWidthPx(screenWidth)` (e.g. 45% of screen width per side).

3. **Player movement**  
   - The player moves left/right **on screen** (skier offset). They are clamped to the track: `skierOffsetX ∈ [-TRACK_HALF_WIDTH_PX, TRACK_HALF_WIDTH_PX]`.  
   - As the road curves, the **camera** follows the path center, so the player must keep moving in the direction of the turn to stay inside the boundaries.

4. **Camera movement**  
   - Every frame: `pathCenterWorldX = getPathCenterXPx(totalScroll * SCROLL_TO_METERS, mission.points)` (or procedural equivalent).  
   - `worldPanX = SCREEN_WIDTH/2 - pathCenterWorldX` so the path center stays at screen center.  
   - The stage (obstacles, boundaries, items) uses `translateX: worldPanXAnim`. Optionally, a **subtle rotation** is applied based on curve direction (turning left/right) for a "leaning into the turn" feel.

5. **Obstacle placement**  
   - Obstacles spawn **along the curved road**: at a given scroll/Y, `pathCenterAtSpawn = getPathCenterXPx(...)` and spawn X is `pathCenterAtSpawn + randomInTrack()`.  
   - So rocks, trees, and items follow the curve, not a straight line.

6. **Boundaries (snow piles / barriers)**  
   - Snow banks spawn at the **left and right edges** of the road at each Y: `leftX = bounds.minX + margin`, `rightX = bounds.maxX - margin`, where `bounds = getTrackBoundsAtScroll(scrollPosAtBoundary, SCREEN_WIDTH)` (or mission path equivalent).  
   - So barriers are always on the curved road edges. Extra banks can be added on the inner side of an upcoming turn (directional cue).

7. **See upcoming curve in advance**  
   - **MiniMap:** Shows the full path (mission points or procedural samples) and current position.  
   - **Turn-ahead indicator:** When a turn is detected (`getPathTurnAhead(distanceMeters, points)`), an arrow (← or →) is shown at the top so the player can react.

8. **Single source of truth**  
   - **Mission mode:** `mission.points` (pre-generated) drives:  
     - Path center at current scroll → camera (worldPanX)  
     - Path center at spawn Y → obstacle/item X  
     - Path bounds at boundary Y → snow bank left/right X  
     - Path turn ahead → UI arrow + extra boundary banks on turn side  
   - **Free ski:** Procedural path functions in `trackPath.ts` provide the same: `getProceduralPathCenterWorldX`, `getTrackBoundsAtScroll`, and turn logic from path derivative.

## File Overview

| File | Role |
|------|------|
| `constants/missions.ts` | Mission path: `generatePathSegments`, `pathSegmentsToPoints`, `getPathCenterXPx`, `getPathTurnAhead`. |
| `constants/trackPath.ts` | Procedural path and track width: `getProceduralPathCenterWorldX`, `getTrackBoundsAtScroll`, `getTrackHalfWidthPx`. |
| `screens/GameScreen.tsx` | Uses path for: camera (worldPanX), skier clamp (TRACK_HALF_WIDTH_PX), spawn positions (pathCenterAtSpawn, bounds), boundary lines, turn arrow, optional stage rotation. |

## Summary

- The game is **not** a simple endless runner on a straight road.  
- The **curved track** is defined before play (mission) or by a deterministic procedural path (free ski).  
- **Player movement**, **camera**, **obstacle placement**, and **boundaries** all depend on the same curve path, giving a consistent winding ski road where the player must follow the turns.
