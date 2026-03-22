export default async function handler(req: any, res: any) {
  const results: Record<string, string> = {};
  const fs = await import("fs");
  const path = await import("path");

  // Check what files exist
  try {
    const taskDir = "/var/task";
    const apiDir = path.join(taskDir, "api");
    results.taskDirExists = fs.existsSync(taskDir).toString();
    results.apiDirExists = fs.existsSync(apiDir).toString();

    if (fs.existsSync(apiDir)) {
      results.apiFiles = fs.readdirSync(apiDir).join(", ");
    }

    const distDir = path.join(apiDir, "dist");
    results.distDirExists = fs.existsSync(distDir).toString();
    if (fs.existsSync(distDir)) {
      results.distFiles = fs.readdirSync(distDir).join(", ");
    }
  } catch (e: any) {
    results.fsError = e.message;
  }

  // Try loading the bundled app
  try {
    const app = await import("./dist/index.js");
    results.bundleLoad = "ok";
    results.bundleType = typeof app.default;
  } catch (e: any) {
    results.bundleLoad = e.message;
    results.bundleStack = (e.stack || "").split("\n").slice(0, 5).join(" | ");
  }

  res.status(200).json(results);
}
