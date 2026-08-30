import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";

const LOCAL_CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean) as string[];

function isServerless(): boolean {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_VERSION ||
      (process.env.VERCEL && process.env.NODE_ENV === "production")
  );
}

async function resolveLocalChrome(): Promise<string> {
  const { access } = await import("fs/promises");
  for (const path of LOCAL_CHROME_PATHS) {
    try {
      await access(path);
      return path;
    } catch {
      continue;
    }
  }
  throw new Error(
    "No local Chrome found for PDF rendering. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH."
  );
}

export async function launchBrowser(): Promise<Browser> {
  const serverless = isServerless();
  console.log(
    `[pdf] launch serverless=${serverless} vercel=${process.env.VERCEL ?? "0"} node_env=${
      process.env.NODE_ENV
    } mem=${process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ?? "?"}MB`
  );

  if (serverless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    chromium.setGraphicsMode = false;

    const started = Date.now();
    const executablePath = await chromium.executablePath();
    console.log(
      `[pdf] chromium binary=${executablePath} unpacked_in=${Date.now() - started}ms`
    );

    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 },
      executablePath,
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath: await resolveLocalChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
}

export async function renderHtmlToPdf(html: string): Promise<Uint8Array> {
  const started = Date.now();
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    console.log(`[pdf] browser up in ${Date.now() - started}ms`);

    const page = await browser.newPage();
    page.on("pageerror", (e: Error) => console.warn(`[pdf] page error: ${e.message}`));

    await page.setContent(html, { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");

    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    console.log(
      `[pdf] printed ${Math.round(pdf.length / 1024)}KB in ${Date.now() - started}ms`
    );
    return new Uint8Array(pdf);
  } catch (error) {
    console.error(
      `[pdf] render FAILED after ${Date.now() - started}ms:`,
      error instanceof Error ? `${error.name}: ${error.message}` : error
    );
    throw error;
  } finally {
    await browser?.close().catch(() => {});
  }
}
