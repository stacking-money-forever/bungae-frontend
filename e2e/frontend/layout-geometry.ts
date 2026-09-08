export type OverflowHit = { tag: string; cls: string; left: number; right: number; width: number; position: string };

export type ChromeBox = { name: string; left: number; right: number; top: number; bottom: number };

export function measureLayout(): {
  viewportWidth: number;
  overflowing: OverflowHit[];
  chrome: ChromeBox[];
  intersections: Array<{ a: string; b: string }>;
} {
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth);
  const overflowing: OverflowHit[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    if (el instanceof SVGElement) continue;
    if (cs.overflowX === "hidden" || cs.overflowX === "clip") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (rect.left < -0.5 || rect.right > vw + 0.5) {
      const cls = typeof el.className === "string" ? el.className : "";
      overflowing.push({
        tag: el.tagName.toLowerCase(),
        cls: cls.slice(0, 90),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        position: cs.position,
      });
    }
  }

  const chromeSelectors: Array<[string, string]> = [
    ['[aria-label="화면 주요 행동"]', "action"],
    ['nav[aria-label="주요 메뉴"]', "tab"],
    ['[aria-label="앱 설치"]', "install"],
    [".create-fab", "fab"],
  ];
  const chrome: ChromeBox[] = [];
  for (const [selector, name] of chromeSelectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    chrome.push({ name, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
  }

  const intersections: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < chrome.length; i += 1) {
    for (let j = i + 1; j < chrome.length; j += 1) {
      const a = chrome[i];
      const b = chrome[j];
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 0.5 && overlapY > 0.5) intersections.push({ a: a.name, b: b.name });
    }
  }

  return { viewportWidth: vw, overflowing, chrome, intersections };
}

export function enlargeRenderedText(): { samples: Array<{ tag: string; before: number; after: number }> } {
  const samples: Array<{ tag: string; before: number; after: number }> = [];
  const seen = new Set<Element>();
  const pick = (selector: string) => {
    const el = document.querySelector(selector);
    if (el) seen.add(el);
  };
  pick("h1, h2");
  pick("p");
  pick("input, textarea, select");
  pick("button, a[href]");
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (el.childElementCount > 0) continue;
    const text = el.textContent?.trim();
    if (!text) continue;
    const before = parseFloat(getComputedStyle(el).fontSize);
    if (!Number.isFinite(before) || before <= 0) continue;
    (el as HTMLElement).style.fontSize = `${before * 2}px`;
    if (samples.length < 8 || seen.has(el)) {
      samples.push({ tag: el.tagName.toLowerCase(), before, after: parseFloat(getComputedStyle(el).fontSize) });
    }
  }
  return { samples };
}
