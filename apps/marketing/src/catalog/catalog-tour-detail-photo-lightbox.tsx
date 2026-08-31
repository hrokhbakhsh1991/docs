"use client";

import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import type { CatalogTourPhotoItem } from "./build-catalog-tour-photo-items";

export type CatalogTourDetailPhotoLightboxLabels = Readonly<{
  readonly close: string;
  readonly prev: string;
  readonly next: string;
  readonly openPhoto: string;
}>;

type LightboxContextValue = Readonly<{
  readonly openPhoto: (index: number, trigger?: HTMLButtonElement | null) => void;
}>;

const CatalogPhotoLightboxContext = createContext<LightboxContextValue | null>(null);

function useCatalogPhotoLightbox(): LightboxContextValue {
  const context = useContext(CatalogPhotoLightboxContext);
  if (context == null) {
    throw new Error(
      "CatalogTourDetailPhotoLightboxTrigger must render inside CatalogTourDetailPhotoLightbox"
    );
  }
  return context;
}

export type CatalogTourDetailPhotoLightboxProps = Readonly<{
  readonly photos: readonly CatalogTourPhotoItem[];
  readonly labels: CatalogTourDetailPhotoLightboxLabels;
  readonly children: ReactNode;
}>;

export function CatalogTourDetailPhotoLightbox({
  photos,
  labels,
  children,
}: CatalogTourDetailPhotoLightboxProps) {
  const t = useTranslations("catalog");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const titleId = useId();

  const close = useCallback(() => {
    setActiveIndex(null);
    dialogRef.current?.close();
    lastTriggerRef.current?.focus();
  }, []);

  const openPhoto = useCallback(
    (index: number, trigger?: HTMLButtonElement | null) => {
      if (index < 0 || index >= photos.length) {
        return;
      }
      lastTriggerRef.current = trigger ?? null;
      setActiveIndex(index);
    },
    [photos.length]
  );

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => {
      if (current == null || photos.length <= 1) {
        return current;
      }
      return (current - 1 + photos.length) % photos.length;
    });
  }, [photos.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => {
      if (current == null || photos.length <= 1) {
        return current;
      }
      return (current + 1) % photos.length;
    });
  }, [photos.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog == null || activeIndex == null) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex == null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (photos.length <= 1) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, close, photos.length, showNext, showPrevious]);

  const activePhoto = activeIndex != null ? photos[activeIndex] : null;
  const counterLabel =
    activeIndex != null
      ? t("detail.gallery.lightboxCounter", {
          current: activeIndex + 1,
          total: photos.length,
        })
      : "";

  return (
    <CatalogPhotoLightboxContext.Provider value={{ openPhoto }}>
      {children}
      <dialog
        ref={dialogRef}
        data-marketing-catalog-detail-photo-lightbox
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={close}
      >
        {activePhoto != null ? (
          <div data-marketing-catalog-detail-photo-lightbox-body>
            <p id={titleId} className="sr-only">
              {activePhoto.alt}
            </p>
            <button
              type="button"
              data-marketing-catalog-detail-photo-lightbox-close
              aria-label={labels.close}
              onClick={close}
            >
              <X aria-hidden="true" />
            </button>
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  data-marketing-catalog-detail-photo-lightbox-prev
                  aria-label={labels.prev}
                  onClick={showPrevious}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-marketing-catalog-detail-photo-lightbox-next
                  aria-label={labels.next}
                  onClick={showNext}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
                <p data-marketing-catalog-detail-photo-lightbox-counter>{counterLabel}</p>
              </>
            ) : null}
            {/* Full-resolution source in modal — display size only in page grid */}
            <img
              src={activePhoto.src}
              alt={activePhoto.alt}
              data-marketing-catalog-detail-photo-lightbox-image
            />
          </div>
        ) : null}
      </dialog>
    </CatalogPhotoLightboxContext.Provider>
  );
}

export type CatalogTourDetailPhotoLightboxTriggerProps = Readonly<{
  readonly index: number;
  readonly children: ReactNode;
  readonly ariaLabel: string;
  readonly overlay?: boolean;
}>;

export function CatalogTourDetailPhotoLightboxTrigger({
  index,
  children,
  ariaLabel,
  overlay = false,
}: CatalogTourDetailPhotoLightboxTriggerProps) {
  const { openPhoto } = useCatalogPhotoLightbox();

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    openPhoto(index, event.currentTarget);
  };

  return (
    <button
      type="button"
      data-marketing-catalog-detail-photo-trigger
      data-marketing-catalog-detail-photo-index={index}
      {...(overlay ? { "data-marketing-catalog-detail-photo-trigger-overlay": true } : {})}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {overlay ? (
        children
      ) : (
        <>
          <span data-marketing-catalog-detail-photo-trigger-media>{children}</span>
          <span data-marketing-catalog-detail-photo-trigger-zoom aria-hidden="true">
            <ZoomIn />
          </span>
        </>
      )}
    </button>
  );
}
