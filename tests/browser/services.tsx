import { useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
import { correctNutrition } from "../../lib/nutrition";
import { todayDate } from "../../lib/dates";
import type { Doc } from "../../convex/_generated/dataModel";
const user = {
  _id: "profile",
  _creationTime: 1,
  name: "Test profile",
  dailyCalorieGoal: 1800,
} as Doc<"users">;
let meals = [
  {
    _id: "legacy",
    _creationTime: 1,
    createdAt: 1,
    userId: user._id,
    name: "Eggs",
    description: "one boiled egg",
    calories: 70,
    protein: 6,
    date: todayDate(),
  },
] as Doc<"meals">[];
if (new URLSearchParams(window.location.search).has("manyMeals")) {
  meals = Array.from({ length: 30 }, (_, i) => ({
    ...meals[0],
    _id: `meal-${i}` as Doc<"meals">["_id"],
    name: `Meal ${i + 1}`,
  }));
}
let version = 0;
const listeners = new Set<() => void>();
const calls: { name: string; args: Record<string, unknown> }[] = [];
Object.assign(window, { testCalls: calls });
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function changed() {
  version++;
  listeners.forEach((listener) => listener());
}
export function useQuery(
  ref: Parameters<typeof getFunctionName>[0],
  args?: Record<string, unknown> | "skip",
) {
  useSyncExternalStore(subscribe, () => version);
  if (args === "skip") return undefined;
  const name = getFunctionName(ref);
  if (name === "users:get") return user;
  if (name === "users:list") return [user];
  if (name === "meals:forDate")
    return meals.filter((meal) => meal.date === args?.date);
  if (name === "meals:forDateRange") return meals;
  throw new Error(`Unexpected query ${name}`);
}
export function useMutation(ref: Parameters<typeof getFunctionName>[0]) {
  return async (args: Record<string, unknown>) => {
    const name = getFunctionName(ref);
    calls.push({ name, args });
    const controls = window as unknown as { failNextSave?: boolean };
    if (name === "meals:add" && controls.failNextSave) {
      controls.failNextSave = false;
      throw new Error("Simulated save failure");
    }
    if (name === "users:updateGoal" || name === "users:updateName") {
      for (const [key, value] of Object.entries(args))
        if (key !== "id")
          Object.assign(user, { [key]: value === null ? undefined : value });
    } else if (name === "meals:updateNutrition") {
      meals = meals.map((meal) =>
        meal._id === args.id
          ? {
              ...meal,
              protein: undefined,
              fiber: undefined,
              carbs: undefined,
              fat: undefined,
              ...correctNutrition(
                meal,
                args.correction as Parameters<typeof correctNutrition>[1],
              ),
            }
          : meal,
      );
    } else if (name === "meals:remove")
      meals = meals.filter((meal) => meal._id !== args.id);
    else if (name === "meals:add")
      meals = [
        ...meals,
        {
          ...args,
          _id: `meal-${calls.length}`,
          createdAt: Date.now(),
        } as Doc<"meals">,
      ];
    changed();
    return `meal-${calls.length}`;
  };
}
const path = () => window.location.hash.slice(1) || "/";
function subscribePath(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
export function usePathname() {
  return useSyncExternalStore(subscribePath, path);
}
export function useRouter() {
  return {
    push: (url: string) => {
      window.location.hash = url;
    },
    replace: (url: string) => {
      window.location.hash = url;
    },
  };
}
export function useUser() {
  return { userId: user._id, clearUser() {}, setUserId() {} };
}
export function redirect(url: string): never {
  throw new Error(`Redirect ${url}`);
}
export default function Link({ href, ...props }: React.ComponentProps<"a">) {
  return <a {...props} href={`#${href}`} />;
}
