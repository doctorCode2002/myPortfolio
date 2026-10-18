/**
 * The visitor's social choices, remembered in localStorage:
 * - `show`: draw other visitors' ghosts (on by default);
 * - `share`: send my own anonymous position (on by default; off = fully opted out).
 */

export type SocialPrefs = { show: boolean; share: boolean };

const KEY = "portfolio.social.v1";
const DEFAULTS: SocialPrefs = { show: true, share: true };

let current: SocialPrefs = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SocialPrefs>;
      current = {
        show: typeof p.show === "boolean" ? p.show : DEFAULTS.show,
        share: typeof p.share === "boolean" ? p.share : DEFAULTS.share,
      };
    }
  } catch {
    // Storage blocked: keep the defaults for this visit.
  }
}

export function getSocialPrefs(): SocialPrefs {
  load();
  return current;
}

export function getServerSocialPrefs(): SocialPrefs {
  return DEFAULTS;
}

export function setSocialPrefs(patch: Partial<SocialPrefs>): void {
  load();
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not persisted; still applies for this visit.
  }
  for (const cb of listeners) cb();
}

export function subscribeSocialPrefs(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
