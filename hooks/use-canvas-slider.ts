'use client';

/**
 * Hook to initialize Swiper on slider layers in the canvas editor.
 * Provides slide navigation when selecting slide layers in the layers panel.
 *
 * Swiper CSS is loaded via CDN in Canvas.tsx (same pattern as GSAP).
 * Swiper JS is bundled and initialized here per-slider instance.
 */

import { useEffect, useRef, useMemo } from 'react';
import Swiper from 'swiper';
import type { Layer, SliderSettings } from '@/types';
import { useEditorStore } from '@/stores/useEditorStore';
import { containsLayerId } from '@/lib/layer-utils';
import { DEFAULT_SLIDER_SETTINGS } from '@/lib/templates/utilities';
import { buildCanvasSwiperOptions, applySwiperEasing } from '@/lib/slider-utils';

/** Registry of active Swiper instances and their layer refs */
const swiperRegistry = new Map<string, { swiper: Swiper; layerRef: React.RefObject<Layer> }>();

/** Tracks the intended target index per slider during rapid navigation */
const targetIndex = new Map<string, number>();

function navigateAndSelect(sliderLayerId: string, direction: 'prev' | 'next') {
  const entry = swiperRegistry.get(sliderLayerId);
  if (!entry) return;
  const { swiper, layerRef } = entry;
  const slides = layerRef.current?.children?.find(c => c.name === 'slides')?.children;
  if (!slides?.length) return;

  const current = targetIndex.get(sliderLayerId) ?? swiper.realIndex;
  const next = direction === 'prev'
    ? (current - 1 + slides.length) % slides.length
    : (current + 1) % slides.length;
  targetIndex.set(sliderLayerId, next);

  swiper.slideTo(next);

  const slideLayer = slides[next];
  if (slideLayer) {
    useEditorStore.getState().setSelectedLayerId(slideLayer.id);
  }
}

/** Navigate to the previous slide and select it */
export function slidePrev(sliderLayerId: string) {
  navigateAndSelect(sliderLayerId, 'prev');
}

/** Navigate to the next slide and select it */
export function slideNext(sliderLayerId: string) {
  navigateAndSelect(sliderLayerId, 'next');
}

/**
 * Initializes Swiper on the canvas for a slider layer and navigates
 * to the correct slide when a slide or its descendant is selected.
 *
 * No-op when `layer.name !== 'slider'` or `isEditMode` is false.
 */
export function useCanvasSlider(
  elementRef: React.RefObject<HTMLElement | null>,
  layer: Layer,
  isEditMode: boolean,
) {
  const swiperRef = useRef<Swiper | null>(null);
  const layerRef = useRef(layer);

  useEffect(() => {
    layerRef.current = layer;
  });

  const isSlider = isEditMode && layer.name === 'slider';

  const settings: SliderSettings = { ...DEFAULT_SLIDER_SETTINGS, ...layer.settings?.slider };
  const settingsKey = useMemo(
    () => `${settings.animationEffect}-${settings.duration}-${settings.easing}-${settings.groupSlide}-${settings.slidesPerGroup}-${settings.centered}-${settings.paginationType}-${settings.navigation}-${settings.loop}`,
    [settings.animationEffect, settings.duration, settings.easing, settings.groupSlide, settings.slidesPerGroup, settings.centered, settings.paginationType, settings.navigation, settings.loop],
  );

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; });

  // Initialize / destroy Swiper when the slider mounts or settings change
  useEffect(() => {
    if (!isSlider || !elementRef.current) return;

    const el = elementRef.current;

    // Create a hidden ghost element for Swiper's fraction pagination.
    // Swiper calculates the real page count and renders it here,
    // so we can read it instead of computing it manually.
    const ghostEl = document.createElement('div');
    ghostEl.style.cssText = 'position:absolute!important;color:transparent!important;z-index:-1!important;pointer-events:none!important';
    el.appendChild(ghostEl);

    const options = buildCanvasSwiperOptions(settingsRef.current, ghostEl);
    const swiper = new Swiper(el, options);
    applySwiperEasing(el, settingsRef.current.easing);

    // Read the page count from Swiper's snap grid and store it
    const { setSliderSnapCount } = useEditorStore.getState();
    const syncSnapCount = () => {
      setSliderSnapCount(layer.id, swiper.snapGrid.length);
    };
    swiper.on('update', syncSnapCount);
    requestAnimationFrame(syncSnapCount);

    // Sync nav button disabled state from Swiper's position tracking.
    // Navigation module is disabled on canvas to prevent click-to-navigate,
    // so we read isBeginning/isEnd directly and set aria-disabled manually.
    // pointer-events is kept enabled so buttons remain selectable in the editor.
    const navWrapper = layerRef.current.children?.find(c => c.name === 'slideNavigationWrapper');
    const prevLayer = navWrapper?.children?.find(c => c.name === 'slideButtonPrev');
    const nextLayer = navWrapper?.children?.find(c => c.name === 'slideButtonNext');
    const prevEl = prevLayer ? el.querySelector(`[data-layer-id="${prevLayer.id}"]`) as HTMLElement : null;
    const nextEl = nextLayer ? el.querySelector(`[data-layer-id="${nextLayer.id}"]`) as HTMLElement : null;

    const syncNavState = () => {
      const canLoop = swiper.params.loop || swiper.params.rewind;
      if (prevEl) {
        if (!canLoop && swiper.isBeginning) {
          prevEl.setAttribute('aria-disabled', 'true');
        } else {
          prevEl.removeAttribute('aria-disabled');
        }
        prevEl.style.pointerEvents = 'auto';
      }
      if (nextEl) {
        if (!canLoop && swiper.isEnd) {
          nextEl.setAttribute('aria-disabled', 'true');
        } else {
          nextEl.removeAttribute('aria-disabled');
        }
        nextEl.style.pointerEvents = 'auto';
      }
    };

    swiper.on('slideChange', syncNavState);
    requestAnimationFrame(syncNavState);

    swiperRef.current = swiper;
    swiperRegistry.set(layer.id, { swiper, layerRef });

    // Restore the selected slide after reinit (e.g. after per-view change)
    const selectedLayerId = useEditorStore.getState().selectedLayerId;
    if (selectedLayerId) {
      const slidesWrapper = layerRef.current.children?.find(c => c.name === 'slides');
      const slideIndex = slidesWrapper?.children?.findIndex(
        child => containsLayerId(child, selectedLayerId),
      ) ?? -1;
      if (slideIndex > 0) {
        requestAnimationFrame(() => swiper.slideTo(slideIndex, 0));
      }
    }

    // Sync pagination state on the canvas depending on pagination type
    const isFraction = settingsRef.current.paginationType === 'fraction';

    const syncBullets = () => {
      if (isFraction) return;
      const snapCount = swiper.snapGrid.length;
      const activeSnapIdx = swiper.snapIndex ?? 0;
      const bulletTemplate = layerRef.current.children
        ?.find(c => c.name === 'slidePaginationWrapper')
        ?.children?.find(c => c.name === 'slideBullets')
        ?.children?.[0];
      if (!bulletTemplate) return;
      const bulletEls = el.querySelectorAll(`[data-layer-id="${bulletTemplate.id}"]`);
      bulletEls.forEach((b, i) => {
        if (i < snapCount && i === activeSnapIdx) {
          b.setAttribute('aria-current', 'true');
        } else {
          b.removeAttribute('aria-current');
        }
      });
    };

    const syncFraction = () => {
      if (!isFraction) return;
      const fractionLayer = layerRef.current.children
        ?.find(c => c.name === 'slidePaginationWrapper')
        ?.children?.find(c => c.name === 'slideFraction');
      if (!fractionLayer) return;
      const fractionEl = el.querySelector(`[data-layer-id="${fractionLayer.id}"]`) as HTMLElement | null;
      if (!fractionEl) return;
      const totalPages = swiper.snapGrid.length;
      const currentPage = (swiper.snapIndex ?? 0) + 1;
      fractionEl.textContent = `${currentPage} / ${totalPages}`;
    };

    const syncPagination = () => {
      syncBullets();
      syncFraction();
    };

    swiper.on('slideChange', syncPagination);
    requestAnimationFrame(syncPagination);

    const { setSliderAnimating } = useEditorStore.getState();
    swiper.on('slideChangeTransitionStart', () => setSliderAnimating(true));
    swiper.on('slideChangeTransitionEnd', () => {
      targetIndex.delete(layer.id);
      setSliderAnimating(false);
    });

    // Swiper's built-in observer uses the parent window's MutationObserver,
    // which can miss mutations in the canvas iframe's document. Use the
    // iframe's own MutationObserver to reliably detect slide changes.
    let wrapperObserver: MutationObserver | undefined;
    const wrapperEl = swiper.wrapperEl;
    if (wrapperEl) {
      const iframeWindow = wrapperEl.ownerDocument.defaultView;
      const ObsCtor = iframeWindow?.MutationObserver;
      if (ObsCtor) {
        let debounceRaf: number | undefined;
        wrapperObserver = new ObsCtor(() => {
          if (debounceRaf) cancelAnimationFrame(debounceRaf);
          debounceRaf = requestAnimationFrame(() => {
            if (swiperRef.current && !swiperRef.current.destroyed) {
              swiperRef.current.update();
            }
          });
        });
        wrapperObserver.observe(wrapperEl, { childList: true, subtree: true });
      }
    }

    return () => {
      wrapperObserver?.disconnect();
      swiperRegistry.delete(layer.id);
      swiper.destroy(true, true);
      ghostEl.remove();
      swiperRef.current = null;
      setSliderAnimating(false);
    };
  }, [isSlider, elementRef, settingsKey, layer.id]);

  // Navigate to the slide containing the selected layer
  useEffect(() => {
    if (!isSlider) return;

    const navigateToSelected = (selectedLayerId: string | null) => {
      const swiper = swiperRef.current;
      if (!swiper || !selectedLayerId) return;

      const slidesWrapper = layerRef.current.children?.find(c => c.name === 'slides');
      if (!slidesWrapper?.children) return;

      const slideIndex = slidesWrapper.children.findIndex(
        child => containsLayerId(child, selectedLayerId),
      );

      if (slideIndex >= 0 && slideIndex !== swiper.realIndex) {
        requestAnimationFrame(() => {
          swiper.update();
          swiper.slideTo(slideIndex);
        });
      }
    };

    // Handle initial selection (e.g. from URL layer= param)
    navigateToSelected(useEditorStore.getState().selectedLayerId);

    let prevSelectedId: string | null = useEditorStore.getState().selectedLayerId;

    const unsubscribe = useEditorStore.subscribe((state) => {
      const selectedLayerId = state.selectedLayerId;
      if (selectedLayerId === prevSelectedId) return;
      prevSelectedId = selectedLayerId;
      navigateToSelected(selectedLayerId);
    });

    return unsubscribe;
  }, [isSlider]);
}
