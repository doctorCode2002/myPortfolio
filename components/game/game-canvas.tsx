"use client";

import type Phaser from "phaser";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function GameCanvas(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let gameInstance: Phaser.Game | null = null;

    async function initGame(): Promise<void> {
      try {
        const [phaserModule, engineModule] = await Promise.all([
          import("phaser"),
          import("./engine/createGame"),
        ]);

        if (!isMounted || !containerRef.current) return;

        const PhaserLib = phaserModule.default;
        gameInstance = engineModule.createGame(containerRef.current, PhaserLib);
        if (isMounted) {
          setHasLoaded(true);
        }
      } catch (err) {
        console.error("Failed to initialize Phaser game engine:", err);
      }
    }

    void initGame();

    return () => {
      isMounted = false;
      if (gameInstance) {
        gameInstance.destroy(true);
        gameInstance = null;
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        id="phaser-game-container"
        className="h-full w-full overflow-hidden"
      />
      {!hasLoaded && (
        <div className="bg-background/90 absolute inset-0 flex items-center justify-center transition-opacity duration-300">
          <div className="flex flex-col items-center gap-3">
            <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        </div>
      )}
    </div>
  );
}
