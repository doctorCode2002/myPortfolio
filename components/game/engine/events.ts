export type GameEventMap = {
  "interact:npc": {
    npcId: string;
    nameKey: string;
    roleKey: string;
    charSheet: string;
    dialogueKey: "demoNpcDialogue";
  };
  "interact:building": {
    buildingId: string;
    titleKey: "demoBuildingTitle";
    messageKey: "demoBuildingDialogue";
  };
  "ui:open": { type: "dialogue" | "building" | "picker" };
  "ui:close": void;
  "player:change-character": { charSheet: string };
  "game:freeze": boolean;
  "prompt:show": { textKey: string; targetId: string } | null;
};

type GenericCallback = (data: unknown) => void;

class GameEventBus {
  private listeners = new Map<keyof GameEventMap, Set<GenericCallback>>();

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

  public emit<K extends keyof GameEventMap>(
    event: K,
    ...args: GameEventMap[K] extends void ? [] : [GameEventMap[K]]
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      const payload = args[0];
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
  }
}

export const gameEvents = new GameEventBus();
