import Phaser from "phaser";
import { ZOOM_LEVELS, computeFitZoom, computeIntegerZoom } from "../constants";

export function setupCameraAndZoom(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  worldWidth: number,
  worldHeight: number,
  onZoomChanged: (zoom: number) => void
): {
  setZoomIndex: (idx: number) => number;
  getTargetZoom: () => number;
} {
  const cam = scene.cameras.main;
  cam.setBackgroundColor("rgba(0,0,0,0)");
  cam.setBounds(0, 0, worldWidth, worldHeight);
  cam.startFollow(playerSprite, true, 0.06, 0.06);

  const isPhone = scene.scale.width < 640;
  let zoomIndex = isPhone
    ? computeFitZoom(scene.scale.width, scene.scale.height)
    : Math.max(
        0,
        ZOOM_LEVELS.findIndex(
          (z) => z === computeIntegerZoom(scene.scale.width, scene.scale.height)
        )
      );
  if (zoomIndex < 0) zoomIndex = 4;

  let targetZoom = ZOOM_LEVELS[zoomIndex] ?? 2;
  cam.setZoom(targetZoom);

  const setZoomIndex = (idx: number): number => {
    zoomIndex = Phaser.Math.Clamp(idx, 0, ZOOM_LEVELS.length - 1);
    targetZoom = ZOOM_LEVELS[zoomIndex] ?? 2;
    onZoomChanged(targetZoom);
    return zoomIndex;
  };

  // Wheel zoom
  scene.input.on(
    "wheel",
    (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      setZoomIndex(dy < 0 ? zoomIndex + 1 : zoomIndex - 1);
    }
  );

  // Pinch zoom on touch
  scene.input.addPointer(1);
  let pinchDist = 0;
  scene.input.on("pointermove", () => {
    const p1 = scene.input.pointer1;
    const p2 = scene.input.pointer2;
    if (p1?.isDown && p2?.isDown) {
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const next = dist > pinchDist ? zoomIndex + 1 : zoomIndex - 1;
      if (pinchDist > 0 && Math.abs(dist - pinchDist) > 25) {
        setZoomIndex(next);
        pinchDist = dist;
      } else if (!pinchDist) pinchDist = dist;
    } else {
      pinchDist = 0;
    }
  });

  return { setZoomIndex, getTargetZoom: () => targetZoom };
}
