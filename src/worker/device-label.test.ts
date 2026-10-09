import { describe, expect, it } from "vitest";
import { deviceLabel } from "./device-label";

const UA = {
  iPhoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iPhoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  iPhoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  iPhoneEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.2592.56 Mobile/15E148 Safari/605.1.15",
  iPadSafari:
    "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  windowsOpera:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  chromeOS:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

describe("deviceLabel", () => {
  it.each([
    [UA.iPhoneSafari, "iPhone · Safari"],
    [UA.iPhoneChrome, "iPhone · Chrome"],
    [UA.iPhoneFirefox, "iPhone · Firefox"],
    [UA.iPhoneEdge, "iPhone · Edge"],
    [UA.iPadSafari, "iPad · Safari"],
    [UA.androidChrome, "Android · Chrome"],
    [UA.androidSamsung, "Android · Samsung Internet"],
    [UA.androidFirefox, "Android · Firefox"],
    [UA.macSafari, "Mac · Safari"],
    [UA.windowsEdge, "Windows · Edge"],
    [UA.windowsOpera, "Windows · Opera"],
    [UA.linuxFirefox, "Linux · Firefox"],
    [UA.chromeOS, "ChromeOS · Chrome"],
  ])("labels %s", (ua, label) => {
    expect(deviceLabel(ua)).toBe(label);
  });

  it("keeps the half it knows", () => {
    expect(deviceLabel("SomeApp/1.0 (Windows NT 10.0)")).toBe("Windows");
    expect(deviceLabel("Mozilla/5.0 (Unknown) Firefox/127.0")).toBe("Firefox");
  });

  it("is null when neither half is known", () => {
    expect(deviceLabel(undefined)).toBeNull();
    expect(deviceLabel(null)).toBeNull();
    expect(deviceLabel("")).toBeNull();
    expect(deviceLabel("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBeNull();
    expect(deviceLabel("curl/8.6.0")).toBeNull();
  });
});
