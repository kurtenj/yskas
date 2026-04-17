"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { OTPFieldPreview as OTPField } from "@base-ui/react/otp-field";

const PIN_LENGTH = 4;

export default function PinPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const id = useId();

  async function handleComplete(pin: string) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Incorrect PIN. Try again.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-mist-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <svg
            width="64"
            height="64"
            viewBox="0 0 315 315"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M174.457 65.5071L225.56 15.1886L247.578 37.1986L174.457 110.327V204.673L247.578 277.801L225.56 299.819L174.457 249.493V315H143.004V249.493L91.9006 299.819L69.8829 277.801L143.004 204.673V173.227H111.557L38.4291 246.348L16.4191 224.33L66.7375 173.227H0V141.773H66.7375L16.4191 90.6702L38.4291 68.6525L111.557 141.773H143.004V110.327L69.8829 37.1986L91.9006 15.1886L143.004 65.5071V0H174.457V65.5071Z"
              fill="#55C8DD"
            />
            <path
              d="M267.75 110.25C293.845 110.25 315 131.405 315 157.5C315 183.595 293.845 204.75 267.75 204.75C241.655 204.75 220.5 183.595 220.5 157.5C220.5 131.405 241.655 110.25 267.75 110.25Z"
              fill="#55C8DD"
            />
          </svg>
        </div>

        <div className="space-y-4">
          <label htmlFor={id} className="sr-only">PIN</label>
          <OTPField.Root
            id={id}
            length={PIN_LENGTH}
            validationType="numeric"
            onValueComplete={handleComplete}
            className="flex w-full gap-2 justify-center"
          >
            {Array.from({ length: PIN_LENGTH }, (_, index) => (
              <OTPField.Input
                key={index}
                autoFocus={index === 0}
                className="box-border m-0 h-11 w-10 rounded-lg border border-mist-800 bg-transparent text-center font-inherit text-lg font-medium text-mist-50 outline-none focus:outline-solid focus:outline-2 focus:-outline-offset-1 focus:outline-mist-400 caret-transparent"
              />
            ))}
          </OTPField.Root>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          {loading && (
            <p className="text-mist-500 text-sm text-center">Checking...</p>
          )}
        </div>
      </div>
    </div>
  );
}
