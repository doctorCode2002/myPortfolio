export type GameEventMap = {
  "interact:npc": {
    npcId: string;
    charSheet: string;
    nameKey?: string | undefined;
    roleKey?: string | undefined;
    dialogueKey?: string | undefined;
    title?: string | undefined;
    subtitle?: string | undefined;
    lines?: string[] | undefined;
  };
  "interact:building": {
    buildingId: string;
    titleKey?: string;
    messageKey?: string;
    title?: string;
    lines?: string[];
  };
  "camera:zoom-in": void;
  "camera:zoom-out": void;
  "camera:set-zoom": { zoom: number };
  "camera:zoom-changed": { zoom: number };
  "ui:open": { type: "dialogue" | "building" | "picker" | string };
  "ui:close": void;
  "player:change-character": { charSheet: string };
  "game:freeze": boolean;
  "editor:set-tool": {
    tool: "brush" | "fill" | "doors" | "spawns" | "anchors";
  };
  "editor:set-material": { material: string };
  "editor:set-brush-size": { size: number };
  "editor:undo": void;
  "editor:redo": void;
  "editor:export-material": void;
  "editor:toggle-layer": { layer: string };
  "editor:data-updated": { art: unknown; canUndo?: boolean; canRedo?: boolean };
  "editor:request-data": void;
  "editor:update-art": { art: unknown };
  "editor:select-item": { tool: string; index: number };
  "editor:set-island": { islandId: string };
  "editor:island-list": { islands: string[]; activeIslandId: string };
  "editor:island-changed": { islandId: string };
};

type GenericCallback = (data: unknown) => void;

class GameEventBus {
  private listeners = new Map<keyof GameEventMap, Set<GenericCallback>>();
  private uiLocks = new Set<string>();

  public on<K extends keyof GameEventMap>(
    event: K,
    callback: (data: GameEventMap[K]) => void
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const genericCb = callback as GenericCallback;
    set.add(genericCb);

    return () => {
      this.off(event, callback);
    };
  }

  public off<K extends keyof GameEventMap>(
    event: K,
    callback: (data: GameEventMap[K]) => void
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as GenericCallback);
    }
  }

  public lockUi(source: string): void {
    const wasLocked = this.uiLocks.size > 0;
    this.uiLocks.add(source);
    if (!wasLocked) {
      this.dispatchInternal("game:freeze", true);
    }
    this.dispatchInternal("ui:open", { type: source });
  }

  public unlockUi(source: string): void {
    if (!this.uiLocks.has(source)) return;
    this.uiLocks.delete(source);
    if (this.uiLocks.size === 0) {
      this.dispatchInternal("game:freeze", false);
      this.dispatchInternal("ui:close", undefined);
    }
  }

  public resetUiLocks(): void {
    const hadLocks = this.uiLocks.size > 0;
    this.uiLocks.clear();
    if (hadLocks) {
      this.dispatchInternal("game:freeze", false);
      this.dispatchInternal("ui:close", undefined);
    }
  }

  public isUiLocked(): boolean {
    return this.uiLocks.size > 0;
  }

  public emit<K extends keyof GameEventMap>(
    event: K,
    ...args: GameEventMap[K] extends void ? [] : [GameEventMap[K]]
  ): void {
    const payload = args[0];

    // Intercept manual ui:close to clear all locks and guarantee unfreeze
    if (event === "ui:close") {
      this.uiLocks.clear();
      this.dispatchInternal("game:freeze", false);
    } else if (event === "ui:open") {
      const openPayload = payload as GameEventMap["ui:open"];
      this.uiLocks.add(openPayload?.type ?? "overlay");
      this.dispatchInternal("game:freeze", true);
    }

    this.dispatchInternal(event, payload);
  }

  private dispatchInternal<K extends keyof GameEventMap>(
    event: K,
    payload: unknown
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error handling game event "${event}":`, err);
        }
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
    this.uiLocks.clear();
  }
}

export const gameEvents = new GameEventBus();
