import { devices, type BrowserContextOptions, type BrowserType, chromium, firefox, webkit } from "playwright";

type RouteCheck = {
  path: string;
  expectTitle?: RegExp;
};

type Target = {
  name: string;
  browserType: BrowserType;
  contextOptions?: BrowserContextOptions;
};

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const routeChecks: RouteCheck[] = [
  { path: "/", expectTitle: /GiveKhair|Home/i },
  { path: "/auth/signin", expectTitle: /GiveKhair|Sign in/i },
  { path: "/charities", expectTitle: /Charities/i },
  { path: "/charities/awet", expectTitle: /Angle Welfare Education Trust|GiveKhair/i },
];

const targets: Target[] = [
  { name: "Desktop Chrome", browserType: chromium },
  { name: "Desktop Firefox", browserType: firefox },
  { name: "Desktop Safari", browserType: webkit },
  {
    name: "iPhone 13 Safari",
    browserType: webkit,
    contextOptions: { ...devices["iPhone 13"] },
  },
  {
    name: "Pixel 7 Chrome",
    browserType: chromium,
    contextOptions: { ...devices["Pixel 7"] },
  },
];

async function run() {
  const failures: string[] = [];

  for (const target of targets) {
    const browser = await target.browserType.launch();
    const context = await browser.newContext(target.contextOptions);
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    for (const routeCheck of routeChecks) {
      const url = new URL(routeCheck.path, baseUrl).toString();
      const response = await page.goto(url, { waitUntil: "networkidle" });
      const title = await page.title();
      const rootError = await page.locator("#__next_error__").count();
      const bodyText = (await page.locator("body").innerText()).trim();

      if (!response || !response.ok()) {
        failures.push(`${target.name} ${routeCheck.path}: bad response ${response?.status() ?? "NO_RESPONSE"}`);
      }

      if (routeCheck.expectTitle && !routeCheck.expectTitle.test(title)) {
        failures.push(`${target.name} ${routeCheck.path}: unexpected title "${title}"`);
      }

      if (rootError > 0) {
        failures.push(`${target.name} ${routeCheck.path}: rendered Next.js error shell`);
      }

      if (bodyText.length === 0) {
        failures.push(`${target.name} ${routeCheck.path}: empty body text`);
      }
    }

    if (pageErrors.length > 0) {
      failures.push(`${target.name}: page errors ${pageErrors.join(" | ")}`);
    }

    if (consoleErrors.length > 0) {
      failures.push(`${target.name}: console errors ${consoleErrors.join(" | ")}`);
    }

    await context.close();
    await browser.close();
  }

  if (failures.length > 0) {
    console.error("Browser verification failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Browser verification checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
