"use client";

import { useEffect } from "react";

/*
 * "On hover" in the Style panel shows the selected piece's hover look on the canvas without the pointer on it, the
 * way a browser's developer tools force :hover. Every `:hover` rule in the canvas's stylesheets gets a copy that
 * matches `[data-vt-force-hover]` instead, and that attribute goes on the selected piece. Copies are made once per
 * stylesheet (new sheets, such as CSS for classes just added, are picked up as they arrive) and match nothing while
 * no piece carries the attribute. The design's own hover rules show too, including `.group:hover .child` ones.
 * Editor only: the attribute and copies never reach a saved design.
 */

export const FORCE_HOVER = "data-vt-force-hover";
const FORCED = `[${FORCE_HOVER}]`;

/** `.card:hover .title` → `.card[data-vt-force-hover] .title`; null when the selector has no :hover. */
export function forcedSelector(selector: string): string | null {
  if (!selector.includes(":hover") || selector.includes(FORCE_HOVER)) return null;
  // `\:hover` inside an escaped class name (`.vt\:hover\:bg-accent`) is part of the name, not the pseudo-class.
  const out = selector.replace(/(?<!\\):hover(?![\w-])/g, FORCED);
  return out === selector ? null : out;
}

type RuleParent = CSSStyleSheet | CSSGroupingRule | CSSStyleRule;

function copyHoverRules(parent: RuleParent) {
  let rules: CSSRuleList;
  try {
    rules = parent.cssRules;
  } catch {
    return; // Another origin's stylesheet (web fonts): no hover rules of ours.
  }
  // Backwards, so inserting after a rule leaves the ones still to visit where they were.
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i]!;
    if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) copyHoverRules(rule as CSSGroupingRule);
    // The canvas is another window, so its rules fail `instanceof CSSStyleRule` here: look for a selector instead.
    const style = rule as CSSStyleRule;
    if (typeof style.selectorText !== "string") continue;
    const selector = forcedSelector(style.selectorText);
    if (!selector || !style.cssText.startsWith(style.selectorText)) continue;
    try {
      (parent as CSSStyleSheet).insertRule(selector + style.cssText.slice(style.selectorText.length), i + 1);
    } catch {
      // A selector this browser can't parse once rewritten: that hover look just isn't previewed.
    }
  }
}

const done = new WeakSet<CSSStyleSheet>();
function copyAll(doc: Document) {
  for (const sheet of doc.styleSheets) {
    if (done.has(sheet)) continue;
    done.add(sheet);
    copyHoverRules(sheet);
  }
}

const canvasDoc = () => document.querySelector<HTMLIFrameElement>("iframe")?.contentDocument ?? null;

/** While `id` is set, the piece with that id shows its hover look on the canvas. */
export function useForceHover(id: string | null) {
  useEffect(() => {
    if (!id) return;
    let doc: Document | null = null;
    let observer: MutationObserver | undefined;
    let frame = 0;
    let marked: HTMLElement | null = null;
    const apply = () => {
      frame = 0;
      if (!doc) return;
      copyAll(doc);
      const el = doc.querySelector<HTMLElement>(`[data-puck-component="${CSS.escape(id)}"]`);
      if (el === marked) return;
      marked?.removeAttribute(FORCE_HOVER);
      marked = el;
      marked?.setAttribute(FORCE_HOVER, "");
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    // The canvas may still be loading when the panel opens.
    const start = () => {
      doc = canvasDoc();
      if (!doc?.documentElement) return void (frame = requestAnimationFrame(start));
      observer = new MutationObserver(schedule);
      observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
      apply();
    };
    start();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      marked?.removeAttribute(FORCE_HOVER);
    };
  }, [id]);
}
