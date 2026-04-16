"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";

export default function SelectPage() {
  const users = useQuery(api.users.list);
  const createUser = useMutation(api.users.create);
  const { setUserId } = useUser();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("1800");
  const [creating, setCreating] = useState(false);

  function selectUser(id: Id<"users">) {
    setUserId(id);
    router.push("/");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !goal) return;
    setCreating(true);
    try {
      const id = await createUser({
        name: name.trim(),
        dailyCalorieGoal: parseInt(goal, 10),
      });
      setUserId(id);
      router.push("/");
    } finally {
      setCreating(false);
    }
  }

  if (users === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">👤</div>
          <h1 className="text-2xl font-bold text-white">Who&apos;s tracking?</h1>
          <p className="text-slate-400 mt-1 text-sm">Select your profile to continue</p>
        </div>

        {!showCreate ? (
          <div className="space-y-3">
            {users.map((user) => (
              <button
                key={user._id}
                onClick={() => selectUser(user._id)}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-5 py-4 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{user.name}</p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      Goal: {user.dailyCalorieGoal.toLocaleString()} cal/day
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}

            <button
              onClick={() => setShowCreate(true)}
              className="w-full border border-dashed border-slate-600 hover:border-emerald-600 rounded-xl px-5 py-4 text-slate-400 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jonathan"
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Daily calorie goal</label>
              <input
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                min="500"
                max="5000"
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-slate-500 text-xs mt-1.5">
                Typical deficit goal: 1,500–1,800 cal/day
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setName(""); setGoal("1800"); }}
                className="flex-1 bg-slate-800 text-slate-300 rounded-xl py-3 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || !goal || creating}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl py-3 font-semibold transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
