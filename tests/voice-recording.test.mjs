import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual hook with controlled browser audio and lifecycle events.
const code = ts.transpileModule(readFileSync('app/(app)/use-voice-recording.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup(getMedia) {
  let now = 0, level = 0, requests = 0, cleanup, tick;
  const events = {};
  const tracks = [];
  const audios = [], errors = [];
  const document = { hidden: false, addEventListener: (name, cb) => { events[name] = cb; }, removeEventListener() {} };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm'; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['audio']) });
      this.onstop?.();
    }
  }
  class AudioContext {
    state = 'running';
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 2048, getFloatTimeDomainData: (data) => data.fill(level) }; }
  }
  const exports = {};
  vm.runInNewContext(code, {
    exports, Blob, AbortController, DOMException, AudioContext, MediaRecorder: Recorder,
    Float32Array, performance: { now: () => now }, document,
    window: { addEventListener() {}, removeEventListener() {} },
    setInterval: (cb) => { tick = cb; return 1; }, clearInterval: () => { tick = undefined; },
    navigator: { mediaDevices: { getUserMedia: async () => {
      requests++;
      if (getMedia) await getMedia();
      const track = { enabled: true, readyState: 'live', stop() { this.readyState = 'ended'; } };
      tracks.push(track);
      return { getAudioTracks: () => [track], getTracks: () => [track] };
    } } },
    require: () => ({ useRef: (current) => ({ current }), useState: (value) => [value, () => {}], useEffect: (effect) => { cleanup = effect(); } }),
  });
  const hook = exports.useVoiceRecording({ enabled: true, onAudio: async (audio) => audios.push(audio), onError: (error) => errors.push(error) });
  return {
    hook, audios, errors, tracks, requests: () => requests,
    advance(ms, amplitude = 0) { level = amplitude; for (let i = 0; i < ms; i += 100) { now += 100; tick?.(); } },
    hide() { document.hidden = true; events.visibilitychange(); },
    show() { document.hidden = false; },
    cleanup: () => cleanup(),
  };
}

test('speech followed by silence finishes once; next recording reuses muted microphone', async () => {
  const s = setup();
  await s.hook.handleMic();
  s.advance(500, 0.05);
  s.advance(1400);
  assert.equal(s.audios.length, 0);
  s.advance(100);
  await new Promise(setImmediate);
  assert.equal(s.audios.length, 1);
  assert.equal(s.tracks[0].enabled, false);
  await s.hook.handleMic();
  assert.equal(s.requests(), 1);
  assert.equal(s.tracks[0].enabled, true);
  s.advance(400, 0.05);
  await s.hook.handleMic();
  assert.equal(s.audios.length, 2);
  s.cleanup();
});

test('silence does not upload or log a meal', async () => {
  const s = setup();
  await s.hook.handleMic();
  s.advance(10000);
  assert.equal(s.audios.length, 0);
  assert.match(s.errors[0], /No speech/);
  s.cleanup();
});

test('backgrounding cancels recording and releases the microphone', async () => {
  const s = setup();
  await s.hook.handleMic();
  s.advance(400, 0.05);
  s.hide();
  assert.equal(s.audios.length, 0);
  assert.equal(s.tracks[0].readyState, 'ended');
  s.show();
  await s.hook.handleMic();
  assert.equal(s.requests(), 2);
  s.cleanup();
});

test('rapid taps request permission only once and late permission is released on unmount', async () => {
  let allow;
  const s = setup(() => new Promise((resolve) => { allow = resolve; }));
  const first = s.hook.handleMic();
  await Promise.resolve();
  await s.hook.handleMic();
  assert.equal(s.requests(), 1);
  s.cleanup();
  allow();
  await first;
  assert.equal(s.tracks[0].readyState, 'ended');
  assert.equal(s.audios.length, 0);
});

test('continuous sound is capped at one minute', async () => {
  const s = setup();
  await s.hook.handleMic();
  s.advance(60000, 0.05);
  assert.equal(s.audios.length, 1);
  assert.equal(s.tracks[0].enabled, false);
  s.cleanup();
});
