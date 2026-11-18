import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// This opt-in real encoder check needs local ffmpeg/ffprobe. It creates only
// synthetic media and serves it from an ephemeral localhost server.
test.skip(process.env.MUSIC_VIDEO_MEDIA_TEST !== "1", "Enable MUSIC_VIDEO_MEDIA_TEST=1 with ffmpeg for the real encoder check.");
test("exports the full song over a looping clip and retries without a new generation", async ({ page }, testInfo) => {
  const root = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "dreamforge-music-test-"));
  const videoPath = join(dir, "clip.mp4"), audioPath = join(dir, "song.wav"), bundlePath = join(dir, "export.js");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=320x240:r=30:d=0.5[r];color=c=blue:s=320x240:r=30:d=0.5[b];[r][b]concat=n=2:v=1:a=0", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoPath]);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:a", "pcm_s16le", audioPath]);
  await build({ entryPoints: [resolve(root, "client/src/lib/musicVideoExport.ts")], outfile: bundlePath, bundle: true, format: "esm", platform: "browser", alias: { "@": resolve(root, "client/src"), "@shared": resolve(root, "shared") } });
  const html = `<!doctype html><button id="export">Export</button><a id="download" download="result.webm">Download</a><script type="module">
    import { exportMusicVideo } from '/export.js';
    window.stats = { created: 0, revoked: 0, state: 'idle', error: '' };
    const make = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.stats.created++; return make(blob); };
    URL.revokeObjectURL = url => { window.stats.revoked++; revoke(url); };
    const file = new File([await (await fetch('/song.wav')).blob()], 'song.wav', {type:'audio/wav'});
    document.querySelector('#export').onclick = async () => {
      window.stats.state = 'running';
      try {
        const result = await exportMusicVideo({ videoUrl:'/api/media/animation/17/12345678-1234-4234-9234-123456789abc.mp4', userId:17, audio:file, signal:new AbortController().signal, onProgress:()=>{} });
        const url = make(result.blob); document.querySelector('#download').href = url;
        window.stats.state = 'done'; window.stats.mime = result.mime; window.stats.size = result.blob.size;
      } catch (error) { window.stats.state = 'failed'; window.stats.error = String(error); }
    };
  </script>`;
  let failVideo = true, server: Server | undefined;
  try {
    server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      if (path === "/") { response.writeHead(200, { "content-type": "text/html" }); response.end(html); }
      else if (path === "/export.js") { response.writeHead(200, { "content-type": "text/javascript" }); response.end(readFileSync(bundlePath)); }
      else if (path === "/song.wav") { response.writeHead(200, { "content-type": "audio/wav" }); response.end(readFileSync(audioPath)); }
      else if (path.startsWith("/api/media/animation/17/")) { response.writeHead(200, { "content-type": "video/mp4" }); response.end(failVideo ? Buffer.from("not a video") : readFileSync(videoPath)); }
      else { response.writeHead(404); response.end(); }
    });
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole("button", { name: "Export" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).stats.state)).toBe("failed");
    const failed = await page.evaluate(() => (window as any).stats);
    expect(failed.error).toMatch(/decode|playable/i);
    expect(failed.created).toBe(failed.revoked);
    failVideo = false;
    await page.getByRole("button", { name: "Export" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).stats.state), { timeout: 30_000 }).toBe("done");
    const finished = await page.evaluate(() => (window as any).stats);
    expect(finished.size).toBeGreaterThan(1000);
    expect(finished.created).toBe(finished.revoked);
    const download = page.waitForEvent("download"); await page.getByRole("link", { name: "Download" }).click();
    const outputPath = testInfo.outputPath("music-video.webm"); await (await download).saveAs(outputPath);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "json", outputPath], { encoding: "utf8" }));
    expect(probe.streams.map((stream: { codec_type: string }) => stream.codec_type)).toEqual(expect.arrayContaining(["video", "audio"]));
    // MediaRecorder WebM may omit a duration header; the last packet time is
    // the reliable measure of its actual recorded duration.
    const packets = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time", "-of", "json", outputPath], { encoding: "utf8" }));
    const lastTime = Number(packets.packets.at(-1).pts_time);
    expect(lastTime).toBeGreaterThan(2.7);
    expect(lastTime).toBeLessThan(4.5);
    const sound = spawnSync("ffmpeg", ["-hide_banner", "-i", outputPath, "-vn", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
    expect(sound.status).toBe(0);
    const peak = /max_volume:\s*(-?[\d.]+) dB/.exec(sound.stderr);
    expect(peak).not.toBeNull(); expect(Number(peak![1])).toBeGreaterThan(-50);
    const lateRed = join(dir, "late-red.rgb"), lateBlue = join(dir, "late-blue.rgb");
    for (const [time, path] of [["2.2", lateRed], ["2.7", lateBlue]]) {
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", time, "-i", outputPath, "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", path]);
    }
    const red = readFileSync(lateRed), blue = readFileSync(lateBlue);
    expect(red[0]).toBeGreaterThan(100); expect(red[0]).toBeGreaterThan(red[2] * 2);
    expect(blue[2]).toBeGreaterThan(100); expect(blue[2]).toBeGreaterThan(blue[0] * 2);
  } finally { await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()); }
});
