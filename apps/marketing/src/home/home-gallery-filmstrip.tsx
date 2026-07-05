"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode, type UIEvent } from "react";

type HomeGalleryFilmstripProps = Readonly<{
  readonly children: ReactNode;
  readonly prevLabel: string;
  readonly nextLabel: string;
}>;

const SCROLL_EDGE_TOLERANCE_PX = 6;

function readNormalizedScrollLeft(element: HTMLElement): number {
  const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
  if (maxScroll === 0) {
    return 0;
  }

  const raw = element.scrollLeft;
  if (raw < 0) {
    return Math.min(maxScroll, Math.abs(raw));
  }

  return Math.min(maxScroll, raw);
}

function readActiveItemIndex(element: HTMLElement): number {
  const items = [
    ...element.querySelectorAll<HTMLElement>("figure[data-marketing-home-gallery-item]"),
  ];
  if (items.length === 0) {
    return 0;
  }

  const containerRect = element.getBoundingClientRect();
  const anchorX = containerRect.left + containerRect.width * 0.2;

  let activeIndex = 0;
  let minDistance = Number.POSITIVE_INFINITY;

  items.forEach((item, index) => {
    const rect = item.getBoundingClientRect();
    const distance = Math.abs(rect.left - anchorX);
    if (distance < minDistance) {
      minDistance = distance;
      activeIndex = index;
    }
  });

  return activeIndex;
}

function scrollToItem(element: HTMLElement, index: number): void {
  const items = [
    ...element.querySelectorAll<HTMLElement>("figure[data-marketing-home-gallery-item]"),
  ];
  const target = items[index];
  if (target == null) {
    return;
  }

  target.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "start",
  });
}

export function HomeGalleryFilmstrip({
  children,
  prevLabel,
  nextLabel,
}: HomeGalleryFilmstripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const syncScrollState = useCallback(() => {
    const element = scrollerRef.current;
    if (element == null) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }

    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    if (maxScroll <= SCROLL_EDGE_TOLERANCE_PX) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }

    const offset = readNormalizedScrollLeft(element);
    setCanScrollPrev(offset > SCROLL_EDGE_TOLERANCE_PX);
    setCanScrollNext(offset < maxScroll - SCROLL_EDGE_TOLERANCE_PX);
  }, []);

  useEffect(() => {
    syncScrollState();

    const element = scrollerRef.current;
    if (element == null) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      syncScrollState();
    });
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [syncScrollState]);

  const scrollByStep = (direction: -1 | 1) => {
    const element = scrollerRef.current;
    if (element == null) {
      return;
    }

    const items = element.querySelectorAll("figure[data-marketing-home-gallery-item]");
    if (items.length === 0) {
      return;
    }

    const activeIndex = readActiveItemIndex(element);
    const nextIndex = Math.max(0, Math.min(items.length - 1, activeIndex + direction));
    scrollToItem(element, nextIndex);
  };

  const onScrollerScroll = (_event: UIEvent<HTMLDivElement>) => {
    syncScrollState();
  };

  return (
    <div data-marketing-home-gallery-filmstrip>
      <button
        type="button"
        data-marketing-home-gallery-scroll-prev
        aria-label={prevLabel}
        disabled={!canScrollPrev}
        onClick={() => scrollByStep(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <div ref={scrollerRef} data-marketing-home-gallery-support onScroll={onScrollerScroll}>
        {children}
      </div>
      <button
        type="button"
        data-marketing-home-gallery-scroll-next
        aria-label={nextLabel}
        disabled={!canScrollNext}
        onClick={() => scrollByStep(1)}
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
