"use client";

import { useEffect, useRef, useState } from "react";

export function useVoiceRecording({
  enabled,
  onAudio,
  onError,
}: {
  enabled: boolean;
  onAudio: (audio: Blob, signal: AbortSignal) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const cleanupAudio = useRef<() => void>(() => {});
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function release() {
      generation.current++;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      recorderRef.current = null;
      cleanupAudio.current();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      locked.current = false;
      setRecording(false);
      setStarting(false);
    }
    function onVisibility() {
      if (document.hidden) {
        release();
        setRecording(false);
        setStarting(false);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", release);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", release);
      release();
      requestRef.current?.abort();
    };
  }, [enabled]);

  async function handleMic() {
    const current = recorderRef.current;
    if (current?.state === "recording") {
      current.stop();
      return;
    }
    if (!enabled || locked.current) return;
    locked.current = true;
    setStarting(true);
    const session = generation.current;
    let context: AudioContext | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Voice recording is unavailable. Open this app in a browser over HTTPS.");
      }
      // Create/resume during the tap so mobile browsers can activate audio analysis.
      context = new AudioContext();
      await context.resume();
      if (session !== generation.current || document.hidden) {
        void context.close();
        return;
      }
      let stream = streamRef.current;
      if (!stream || !stream.getAudioTracks().some((track) => track.readyState === "live")) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }
      if (session !== generation.current || document.hidden) {
        stream.getTracks().forEach((track) => track.stop());
        void context.close();
        return;
      }
      streamRef.current = stream;
      stream.getAudioTracks().forEach((track) => { track.enabled = true; });
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let heardSpeech = false;
      let voicedFrames = 0;
      let lastSpeech = performance.now();
      const started = lastSpeech;
      cleanupAudio.current = () => {
        clearInterval(timer);
        source.disconnect();
        if (context?.state !== "closed") void context?.close();
        // Retain permission within this visible session, but capture only silence while idle.
        stream.getAudioTracks().forEach((track) => { track.enabled = false; });
      };
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        cleanupAudio.current();
        recorderRef.current = null;
        locked.current = false;
        setRecording(false);
        onError("Recording was interrupted. Tap the microphone to try again.");
      };
      recorder.onstop = async () => {
        cleanupAudio.current();
        recorderRef.current = null;
        setRecording(false);
        const audio = new Blob(chunks, { type: recorder.mimeType });
        if (!heardSpeech || !audio.size) {
          locked.current = false;
          onError("No speech heard. Tap the microphone and try again.");
          return;
        }
        const controller = new AbortController();
        requestRef.current = controller;
        try {
          await onAudio(audio, controller.signal);
        } catch {
          if (!controller.signal.aborted) onError("Could not log your meal. Please try again.");
        } finally {
          if (requestRef.current === controller) requestRef.current = null;
          locked.current = false;
        }
      };
      recorder.start();
      setStarting(false);
      setRecording(true);
      const timer = setInterval(() => {
        if (recorder.state !== "recording") return;
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
        const now = performance.now();
        if (rms > 0.015) {
          voicedFrames++;
          if (voicedFrames >= 3) heardSpeech = true;
          lastSpeech = now;
        } else {
          voicedFrames = 0;
        }
        if ((heardSpeech && now - lastSpeech >= 1500) ||
            (!heardSpeech && now - started >= 10000) || now - started >= 60000) {
          recorder.stop();
        }
      }, 100);
    } catch (error) {
      if (context?.state !== "closed") void context?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (session !== generation.current) return;
      locked.current = false;
      setStarting(false);
      onError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Allow microphone access in this site's browser settings, then try again."
        : error instanceof Error ? error.message : "Could not start recording");
    }
  }

  return { recording, starting, handleMic };
}
