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

  function handleComplete(pin: string) {
    setError("");
    setLoading(true);

    fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    })
      .then((res) => {
        if (res.ok) {
          router.push("/");
          router.refresh();
        } else {
          setError("Incorrect PIN. Try again.");
        }
      })
      .catch(() => setError("Something went wrong. Try again."))
      .finally(() => setLoading(false));
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
              d="M174.46 65.51L225.56 15.19L247.58 37.2L174.46 110.33V204.67L247.58 277.8L225.56 299.82L174.46 249.49V315H143V249.49L91.9 299.82L69.88 277.8L143 204.67V173.23H111.56L38.43 246.35L16.42 224.33L66.74 173.23H0V141.77H66.74L16.42 90.67L38.43 68.65L111.56 141.77H143V110.33L69.88 37.2L91.9 15.19L143 65.51V0H174.46V65.51Z"
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

          {error && <p className="text-cyan-500 text-sm text-center">{error}</p>}

          {loading && (
            <p className="text-mist-500 text-sm text-center">Checking...</p>
          )}
        </div>
      </div>
    </div>
  );
}
