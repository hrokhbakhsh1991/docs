"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DraftEngine } from "./engine";
import type { DraftEngineConfig, DraftEngineState, DraftSetDataOptions } from "./types";

function createEngineWithLiveConfig<T>(configRef: { current: DraftEngineConfig<T> }): DraftEngine<T> {
  const config: DraftEngineConfig<T> = {
    get id() {
      return configRef.current.id;
    },
    get conflictStrategy() {
      return configRef.current.conflictStrategy;
    },
    get autoApply() {
      return configRef.current.autoApply;
    },
    get debounceMs() {
      return configRef.current.debounceMs;
    },
    get merge() {
      return configRef.current.merge;
    },
    get schemaGate() {
      return configRef.current.schemaGate;
    },
    onFetch: () => configRef.current.onFetch(),
    onPush: (payload, options) => configRef.current.onPush(payload, options),
  };
  if (configRef.current.onDelete != null) {
    config.onDelete = async () => {
      await configRef.current.onDelete?.();
    };
  }
  return new DraftEngine<T>(config);
}

export function useDraftEngine<T>(config: DraftEngineConfig<T>): {
  state: DraftEngineState<T>;
  setDraftData: (_data: T, _options?: DraftSetDataOptions) => void;
  retry: () => Promise<void>;
  flush: () => Promise<void>;
  flushKeepalive: () => void;
  initialize: () => Promise<void>;
  applyDraft: () => void;
  clearDraft: () => Promise<void>;
  revertToLastValid: () => void;
  hasLastValidSnapshot: () => boolean;
} {
  const configRef = useRef(config);
  configRef.current = config;

  const engineRef = useRef<DraftEngine<T> | null>(null);
  const [state, setState] = useState<DraftEngineState<T>>(() => {
    engineRef.current = createEngineWithLiveConfig(configRef);
    return engineRef.current.getState();
  });

  useEffect(() => {
    engineRef.current = createEngineWithLiveConfig(configRef);
    setState(engineRef.current.getState());
    return engineRef.current.subscribe((next) => {
      setState(next);
    });
  }, [config.id]);

  const initialize = useCallback(async () => {
    await engineRef.current?.initialize();
  }, []);

  const setDraftData = useCallback((data: T, options?: DraftSetDataOptions) => {
    engineRef.current?.setDraftData(data, options);
  }, []);

  const retry = useCallback(async () => {
    await engineRef.current?.retry();
  }, []);

  const flush = useCallback(async () => {
    await engineRef.current?.flush();
  }, []);

  const flushKeepalive = useCallback(() => {
    engineRef.current?.flushKeepalive();
  }, []);

  const applyDraft = useCallback(() => {
    engineRef.current?.applyDraft();
  }, []);

  const clearDraft = useCallback(async () => {
    await engineRef.current?.clearDraft();
  }, []);

  const revertToLastValid = useCallback(() => {
    engineRef.current?.revertToLastValid();
  }, []);

  const hasLastValidSnapshot = useCallback(() => {
    return engineRef.current?.hasLastValidSnapshot() ?? false;
  }, []);

  return {
    state,
    setDraftData,
    retry,
    flush,
    flushKeepalive,
    initialize,
    applyDraft,
    clearDraft,
    revertToLastValid,
    hasLastValidSnapshot,
  };
}
