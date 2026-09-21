const USER_KEY = "yskas_user_id";
export function readProfile(storage: Pick<Storage, "getItem">): string | null {
  try {
    return storage.getItem(USER_KEY);
  } catch {
    return null;
  }
}
export function writeProfile(
  storage: Pick<Storage, "setItem" | "removeItem">,
  id: string | null,
) {
  try {
    if (id) storage.setItem(USER_KEY, id);
    else storage.removeItem(USER_KEY);
  } catch {
    /* The in-memory selection still works when storage is unavailable. */
  }
}
