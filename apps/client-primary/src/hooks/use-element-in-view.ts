import { useEffect, useState } from "react";
import type { RefObject } from "react";

type UseElementInViewOptions = {
  /** Root margin: when the element leaves this boundary from the top, inView becomes false. Must be pixels or percent (e.g. "-1px 0px 0px 0px"). */
  rootMargin?: string;
  threshold?: number;
  /** When false, no observer is attached and inView is true. Set to true when the observed element is actually rendered so the effect runs and attaches to the ref. */
  enabled?: boolean;
};

function getScrollRoot(el: Element): Element | null {
  let parent: Element | null = el.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/**
 * Returns true while the element is intersecting its scroll root (or viewport if no scroll parent).
 * Uses the element's scrollable ancestor as root so it works when the page scrolls inside .main-content.
 */
export function useElementInView(
  elementRef: RefObject<Element | null>,
  options: UseElementInViewOptions = {}
): boolean {
  const { rootMargin = "-1px 0px 0px 0px", threshold = 0, enabled = true } = options;
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setInView(true);
      return;
    }
    const el = elementRef.current;
    if (!el) {
      setInView(true);
      return;
    }

    const root = getScrollRoot(el) ?? undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(entry?.isIntersecting ?? true);
      },
      { root, rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [elementRef, rootMargin, threshold, enabled]);

  return inView;
}
