"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";

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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
      <h1 className="text-xl font-bold text-white mb-1">Settings</h1>
      <p className="text-slate-400 text-sm mb-6">Manage your profile</p>

      {/* Profile info */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Current profile</p>
        <p className="text-white font-semibold text-lg">{user?.name}</p>
        <p className="text-slate-400 text-sm mt-0.5">
          Daily goal: <span className="text-emerald-400 font-medium">{user?.dailyCalorieGoal.toLocaleString()} cal</span>
        </p>
      </div>

      {/* Change name */}
      <div className="mb-5">
        <h2 className="text-slate-300 font-medium mb-3">Change name</h2>
        <form onSubmit={handleSaveName} className="flex gap-3">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={user?.name ?? "Name"}
            className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 rounded-xl transition-colors whitespace-nowrap"
          >
            {nameSaved ? "Saved!" : "Save"}
          </button>
        </form>
      </div>

      {/* Change calorie goal */}
      <div className="mb-8">
        <h2 className="text-slate-300 font-medium mb-1">Daily calorie goal</h2>
        <p className="text-slate-500 text-xs mb-3">
          Current: {user?.dailyCalorieGoal.toLocaleString()} cal/day
        </p>
        <form onSubmit={handleSaveGoal} className="flex gap-3">
          <input
            type="number"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder={String(user?.dailyCalorieGoal ?? 1800)}
            min="500"
            max="5000"
            className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!goalInput}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-4 rounded-xl transition-colors whitespace-nowrap"
          >
            {goalSaved ? "Saved!" : "Save"}
          </button>
        </form>
        <p className="text-slate-600 text-xs mt-2">Typical deficit: 1,500–1,800 cal/day</p>
      </div>

      {/* Switch user */}
      <div className="border-t border-slate-800 pt-6">
        <button
          onClick={handleSwitchUser}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Switch profile
        </button>
      </div>
    </div>
  );
}
