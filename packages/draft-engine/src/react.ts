"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DraftEngine } from "./engine";
import type { DraftEngineConfig, DraftEngineState, DraftSetDataOptions, DraftStatus } from "./types";

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
    get normalizeRemote() {
      return configRef.current.normalizeRemote;
    },
    get shouldBypassServerVersionAdoption() {
      return configRef.current.shouldBypassServerVersionAdoption;
    },
    get onPushSuccess() {
      return configRef.current.onPushSuccess;
    },
    get onDiagnostic() {
      return configRef.current.onDiagnostic;
    },
    get onAbortInFlightPush() {
      return configRef.current.onAbortInFlightPush;
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
  flush: () => Promise<DraftStatus | undefined>;
  flushKeepalive: () => void;
  initialize: () => Promise<void>;
  applyDraft: () => void;
  clearDraft: () => Promise<void>;
  clearDraftAndReset: (reset: T) => Promise<void>;
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

  const flush = useCallback(async (): Promise<DraftStatus | undefined> => {
    await engineRef.current?.flush();
    return engineRef.current?.getState().status;
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

  const clearDraftAndReset = useCallback(async (reset: T) => {
    await engineRef.current?.clearDraftAndReset(reset);
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
    clearDraftAndReset,
    revertToLastValid,
    hasLastValidSnapshot,
  };
}
