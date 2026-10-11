import { Mode, State, emptyState, stateSchema, availablePlaces } from "./model";
import { demoState } from "./demo";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const storageKey = (mode: Mode) => `pinny:${mode}:v1`;
export function browserStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem() {
        throw new Error("Storage blocked");
      },
      setItem() {
        throw new Error("Storage blocked");
      },
    };
  }
}
export type LoadResult = {
  state: State;
  warning?: string;
  writable: boolean;
  fresh?: boolean;
};
export function loadState(storage: StorageLike, mode: Mode): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey(mode));
  } catch {
    return {
      state: mode === "demo" ? demoState() : emptyState(),
      warning: "Storage is unavailable. Changes will stay in this tab only.",
      writable: false,
    };
  }
  try {
    if (raw === null)
      return {
        state: mode === "demo" ? demoState() : emptyState(),
        writable: true,
        fresh: true,
      };
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return {
        state: emptyState(),
        warning:
          "Stored data could not be validated. It has been preserved. Reset this workspace to enable saving, or use the other mode.",
        writable: false,
      };
    const state = parsed.data;
    const ids = new Set(availablePlaces(state).map((p) => p.id));
    state.plan = state.plan.filter((s) => ids.has(s.savedPlaceId));
    // Preserve personal history even if a legacy record references a missing place.
    state.context.candidateIds = state.context.candidateIds.filter((id) =>
      ids.has(id),
    );
    if (state.context.selectedId && !ids.has(state.context.selectedId))
      state.context.selectedId = undefined;
    if (!state.plan.length) state.schedule = null;
    return { state, writable: true };
  } catch {
    return {
      state: emptyState(),
      warning:
        "Storage is unavailable or unreadable. Changes will stay in this tab only; existing storage has not been replaced.",
      writable: false,
    };
  }
}
export function saveState(
  storage: StorageLike,
  mode: Mode,
  state: State,
): string | undefined {
  try {
    storage.setItem(storageKey(mode), JSON.stringify(stateSchema.parse(state)));
  } catch {
    return "Could not save to this browser (storage blocked or full). Your changes remain in this tab. Keep this tab open to avoid losing them.";
  }
}
