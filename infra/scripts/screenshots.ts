import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Browser, chromium } from "playwright";
import { DemoNow } from "~/client/mock/db";
import { type Scene, Scenes, SceneViewport } from "~/client/mock/scenes";

const BaseUrl = process.env.SCREENSHOTS_URL ?? "http://localhost:3300";
const OutputFolder = process.env.SCREENSHOTS_DIR ?? "docs/assets";
const DeviceScaleFactor = 2;
const ServerTimeoutMs = 120_000;
const SceneTimeoutMs = 30_000;
const SettleMs = 400;
const PollMs = 500;

async function isServing() {
  try {
    const response = await fetch(BaseUrl);
    return response.status < 500;
  } catch {
    return false;
  }
}

async function startMockServer() {
  if (await isServing()) return undefined;
  const server = spawn("bun", ["run", "dev:mock"], { stdio: "ignore" });
  const deadline = Date.now() + ServerTimeoutMs;
  while (Date.now() < deadline) {
    if (await isServing()) return server;
    await sleep(PollMs);
  }
  server.kill();
  throw new Error(`The mock app never answered at ${BaseUrl}.`);
}

async function warmUp(browser: Browser, scenes: Scene[]) {
  const page = await browser.newPage();
  for (const scene of scenes) {
    await page.goto(BaseUrl + scene.path, { waitUntil: "networkidle" });
  }
  await page.close();
}

async function capture(browser: Browser, scene: Scene) {
  const context = await browser.newContext({
    viewport: SceneViewport[scene.viewport],
    deviceScaleFactor: DeviceScaleFactor,
    reducedMotion: "reduce",
    colorScheme: scene.theme,
    locale: "en-US",
    timezoneId: "America/Sao_Paulo",
  });
  try {
    await context.addCookies([
      {
        name: "the-chatbot-prefs",
        value: encodeURIComponent(
          JSON.stringify({ locale: "en", theme: scene.theme }),
        ),
        url: BaseUrl,
      },
    ]);
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(DemoNow));
    await page.goto(BaseUrl + scene.path, { waitUntil: "networkidle" });
    await page
      .getByText(scene.waitFor)
      .first()
      .waitFor({ timeout: SceneTimeoutMs });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SettleMs);
    return await page.screenshot({ animations: "disabled", caret: "hide" });
  } finally {
    await context.close();
  }
}

function save(name: string, shot: Buffer) {
  const file = join(OutputFolder, `${name}.png`);
  if (existsSync(file) && Buffer.compare(readFileSync(file), shot) === 0) {
    console.log(`unchanged ${file}`);
    return;
  }
  writeFileSync(file, shot);
  console.log(`changed   ${file}`);
}

const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(Scenes);
const unknown = names.filter((name) => !Scenes[name]);
if (unknown.length > 0) {
  throw new Error(
    `No scene called ${unknown.join(", ")}. Scenes: ${Object.keys(Scenes).join(", ")}`,
  );
}
mkdirSync(OutputFolder, { recursive: true });
const server = await startMockServer();
const browser = await chromium.launch();
try {
  await warmUp(
    browser,
    names.map((name) => Scenes[name]),
  );
  for (const name of names) save(name, await capture(browser, Scenes[name]));
} finally {
  await browser.close();
  server?.kill();
}
