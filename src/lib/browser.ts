/**
 * Thin wrappers around browser APIs: chiptune sounds (WebAudio, no files),
 * system notifications and Document Picture-in-Picture.
 */

// --- sound ------------------------------------------------------------------

let audio: AudioContext | null = null;

/** Must be called from a user gesture before sounds can play (autoplay policy). */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

function blip(start: number, freqs: [number, number][], length: number, type: OscillatorType, volume: number) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = type;
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  osc.frequency.setValueAtTime(freqs[0][1], start);
  for (const [at, f] of freqs) osc.frequency.linearRampToValueAtTime(f, start + at);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.03);
  gain.gain.linearRampToValueAtTime(volume * 0.7, start + length * 0.6);
  gain.gain.linearRampToValueAtTime(0, start + length);
  osc.connect(filter).connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** A short 8-bit "mew". */
export function meow(times = 1): void {
  if (!audio) return;
  const now = audio.currentTime;
  for (let i = 0; i < times; i++) {
    blip(
      now + i * 0.42,
      [
        [0, 540],
        [0.08, 860],
        [0.3, 520],
      ],
      0.32,
      "square",
      0.06,
    );
  }
}

/** A soft low rumble for petting. */
export function purr(): void {
  if (!audio) return;
  const now = audio.currentTime;
  for (let i = 0; i < 6; i++) {
    blip(
      now + i * 0.11,
      [
        [0, 70],
        [0.08, 62],
      ],
      0.09,
      "triangle",
      0.12,
    );
  }
}

// --- notifications ---------------------------------------------------------

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/** Asks for permission; resolves to whether notifications can be shown. */
export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export function notify(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, tag: "pomodoro-cat", icon: "/icon.svg" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some platforms (e.g. Android Chrome) only allow notifications from a service worker.
  }
}

// --- Document Picture-in-Picture ------------------------------------------

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

const pipApi = () =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

export const pipSupported = () => pipApi() !== undefined;

/** Opens an always-on-top window carrying over this page's styles and fonts. */
export async function openPipWindow(width: number, height: number): Promise<Window | null> {
  const api = pipApi();
  if (!api) return null;
  const win = await api.requestWindow({ width, height });
  const doc = win.document;

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = doc.createElement("style");
      style.textContent = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      doc.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.appendChild(link);
      }
    }
  }
  doc.documentElement.className = document.documentElement.className;
  doc.documentElement.lang = document.documentElement.lang;
  doc.body.className = "pip-body";
  doc.title = "Pomodoro Cat";
  return win;
}
