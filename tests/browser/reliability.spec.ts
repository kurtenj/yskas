import { expect, test } from "@playwright/test";

test("rapid submissions share one request; a deliberate repeat gets a new operation", async ({
  page,
}) => {
  const ids: string[] = [];
  await page.route("**/api/estimate", (route) => {
    ids.push(route.request().headers()["x-operation-id"]);
    return route.fulfill({ json: { name: "Beans", calories: 200 } });
  });
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "What did you eat?" });
  await input.fill("beans");
  await input.evaluate((el) => {
    const form = el.closest("form")!;
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect(page.getByText("Logged Beans", { exact: true })).toBeVisible();
  expect(ids).toHaveLength(1);
  await input.fill("beans");
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await expect(page.getByText("Logged Beans", { exact: true })).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[0]).not.toBe(ids[1]);
});

test("leaving the page prevents a stale estimate from saving", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/estimate", async (route) => {
    await held;
    await route
      .fulfill({ json: { name: "Stale meal", calories: 200 } })
      .catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "What did you eat?" }).fill("beans");
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Estimating meal...");
  await page.evaluate(() => {
    window.location.hash = "/settings";
  });
  await expect(page.getByLabel("Protein (g)")).toBeVisible();
  release();
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(
    page.getByRole("textbox", { name: "What did you eat?" }),
  ).toHaveValue("");
  expect(
    await page.evaluate(() =>
      (window as unknown as { testCalls: { name: string }[] }).testCalls.filter(
        (c) => c.name === "meals:add",
      ),
    ),
  ).toHaveLength(0);
});

test("backgrounding a submitted text request preserves automatic saving", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/estimate", async (route) => {
    await held;
    await route.fulfill({ json: { name: "Beans", calories: 200 } });
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "What did you eat?" }).fill("beans");
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Estimating meal...");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  release();
  await expect(page.getByText("Logged Beans", { exact: true })).toBeVisible();
});

test("voice transcription, estimate and save use one operation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const track = { enabled: true, readyState: "live", stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => ({
          getTracks: () => [track],
          getAudioTracks: () => [track],
        }),
      },
    });
    class Audio {
      state = "running";
      resume = async () => {};
      close = async () => {
        this.state = "closed";
      };
      createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
      createAnalyser = () => ({
        fftSize: 2048,
        getFloatTimeDomainData(a: Float32Array) {
          a.fill(0.1);
        },
      });
    }
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["test audio"]) });
        this.onstop?.();
      }
    }
    Object.assign(window, { AudioContext: Audio, MediaRecorder: Recorder });
  });
  const ids: string[] = [];
  await page.route("**/api/transcribe", (route) => {
    ids.push(route.request().headers()["x-operation-id"]);
    return route.fulfill({ json: { transcript: "beans" } });
  });
  await page.route("**/api/estimate", (route) => {
    ids.push(route.request().headers()["x-operation-id"]);
    return route.fulfill({ json: { name: "Beans", calories: 200 } });
  });
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Log meal with voice" }).click();
  await expect(
    page.getByRole("button", { name: "Finish and log meal" }),
  ).toBeVisible();
  await page.clock.runFor(400);
  await page.getByRole("button", { name: "Finish and log meal" }).click();
  await expect(page.getByText("Logged Beans", { exact: true })).toBeVisible();
  const saves = await page.evaluate(() =>
    (
      window as unknown as {
        testCalls: { name: string; args: { operationId: string } }[];
      }
    ).testCalls.filter((c) => c.name === "meals:add"),
  );
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  expect(saves[0].args.operationId).toBe(ids[0]);
});
