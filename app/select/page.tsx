"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { CaretRight } from "@phosphor-icons/react";

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Who&apos;s tracking?</h1>
          <p className="text-gray-500 mt-1 text-sm">Select your profile to continue</p>
        </div>

        {!showCreate ? (
          <div className="space-y-3">
            {users.map((user) => (
              <Button
                key={user._id}
                onClick={() => selectUser(user._id)}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-900 font-semibold">{user.name}</p>
                    <p className="text-gray-500 text-sm mt-0.5">
                      Goal: {user.dailyCalorieGoal.toLocaleString()} cal/day
                    </p>
                  </div>
                  <CaretRight size={20} className="text-gray-400" />
                </div>
              </Button>
            ))}

            <Button
              onClick={() => setShowCreate(true)}
              className="w-full border border-dashed border-gray-300 hover:border-gray-900 rounded-xl px-5 py-4 text-gray-500 hover:text-gray-900 transition-colors"
            >
              Add profile
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <Field.Root>
              <Field.Label className="block text-gray-500 text-sm mb-1.5">Name</Field.Label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jonathan"
                className="w-full bg-white text-gray-900 rounded-xl px-4 py-3 border border-gray-200 focus:outline-none focus:border-gray-900"
                autoFocus
              />
            </Field.Root>

            <Field.Root>
              <Field.Label className="block text-gray-500 text-sm mb-1.5">Daily calorie goal</Field.Label>
              <Input
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                min="500"
                max="5000"
                className="w-full bg-white text-gray-900 rounded-xl px-4 py-3 border border-gray-200 focus:outline-none focus:border-gray-900"
              />
              <p className="text-gray-500 text-xs mt-1.5">
                Typical deficit goal: 1,500–1,800 cal/day
              </p>
            </Field.Root>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => { setShowCreate(false); setName(""); setGoal("1800"); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-3 font-medium transition-colors"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || !goal || creating}
                className="flex-1 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl py-3 font-semibold transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
