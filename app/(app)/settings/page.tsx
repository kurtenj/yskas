"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { Heart } from "@phosphor-icons/react";

export default function SettingsPage() {
  const { userId, clearUser } = useUser();
  const user = useQuery(api.users.get, userId ? { id: userId } : "skip");
  const updateGoal = useMutation(api.users.updateGoal);
  const updateName = useMutation(api.users.updateName);
  const router = useRouter();

  const [goalInput, setGoalInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [goalSaved, setGoalSaved] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  if (!userId || user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-mist-800 border-t-mist-100 rounded-full animate-spin" />
      </div>
    );
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !goalInput) return;
    const val = parseInt(goalInput, 10);
    if (isNaN(val) || val < 500 || val > 5000) return;
    await updateGoal({ id: userId, dailyCalorieGoal: val });
    setGoalInput("");
    setGoalSaved(true);
    setTimeout(() => setGoalSaved(false), 2000);
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !nameInput.trim()) return;
    await updateName({ id: userId, name: nameInput.trim() });
    setNameInput("");
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  function handleSwitchUser() {
    clearUser();
    router.push("/select");
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-mist-50 mb-1">Settings</h1>
      <p className="text-mist-400 text-sm mb-6">Manage your profile</p>

      {/* Profile info */}
      <div className="bg-mist-900 border border-mist-800 rounded-xl p-4 mb-6">
        <p className="text-mist-500 text-xs uppercase tracking-wide mb-1">Current profile</p>
        <p className="text-mist-50 font-semibold text-lg">{user?.name}</p>
        <p className="text-mist-400 text-sm mt-0.5">
          Daily goal: <span className="text-mist-50 font-medium">{user?.dailyCalorieGoal.toLocaleString()} cal</span>
        </p>
      </div>

      {/* Change name */}
      <div className="mb-5">
        <h2 className="text-mist-50 font-medium mb-3">Change name</h2>
        <form onSubmit={handleSaveName} className="flex gap-3">
          <Field.Root className="flex-1">
            <Input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={user?.name ?? "Name"}
              className="w-full bg-mist-900 text-mist-50 rounded-xl px-4 py-3 border border-mist-800 focus:outline-none focus:border-mist-400 placeholder:text-mist-600"
            />
          </Field.Root>
          <Button
            type="submit"
            disabled={!nameInput.trim()}
            className="bg-mist-100 hover:bg-mist-200 disabled:bg-mist-800 disabled:text-mist-600 text-mist-950 font-semibold px-4 rounded-xl transition-colors whitespace-nowrap"
          >
            {nameSaved ? "Saved!" : "Save"}
          </Button>
        </form>
      </div>

      {/* Change calorie goal */}
      <div className="mb-8">
        <h2 className="text-mist-50 font-medium mb-1">Daily calorie goal</h2>
        <p className="text-mist-500 text-xs mb-3">
          Current: {user?.dailyCalorieGoal.toLocaleString()} cal/day
        </p>
        <form onSubmit={handleSaveGoal} className="flex gap-3">
          <Field.Root className="flex-1">
            <Input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder={String(user?.dailyCalorieGoal ?? 1800)}
              min="500"
              max="5000"
              className="w-full bg-mist-900 text-mist-50 rounded-xl px-4 py-3 border border-mist-800 focus:outline-none focus:border-mist-400 placeholder:text-mist-600"
            />
          </Field.Root>
          <Button
            type="submit"
            disabled={!goalInput}
            className="bg-mist-100 hover:bg-mist-200 disabled:bg-mist-800 disabled:text-mist-600 text-mist-950 font-semibold px-4 rounded-xl transition-colors whitespace-nowrap"
          >
            {goalSaved ? "Saved!" : "Save"}
          </Button>
        </form>
        <p className="text-mist-600 text-xs mt-2">Typical deficit: 1,500–1,800 cal/day</p>
      </div>

      {/* Switch user */}
      <div className="border-t border-mist-800 pt-6">
        <Button
          onClick={handleSwitchUser}
          className="w-full bg-mist-800 hover:bg-mist-700 text-mist-200 font-medium py-3 rounded-xl transition-colors"
        >
          Switch profile
        </Button>
      </div>

      <footer className="mt-8 mb-4 text-center text-mist-600 text-xs leading-relaxed">
        <p className="flex items-center justify-center gap-1">Grown in the Midwest <Heart weight="fill" className="text-rose-500" size={12} /></p>
        <p>Yskas v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
      </footer>
    </div>
  );
}
