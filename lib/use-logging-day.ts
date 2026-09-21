"use client";
import { useEffect, useState } from "react";
import { nextLoggingMidnight, todayDate } from "./dates";
export function useLoggingDay() {
  const [day, setDay] = useState(todayDate);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      setDay(todayDate());
      timer = setTimeout(refresh, nextLoggingMidnight() - Date.now() + 50);
    }
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return day;
}
