"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DraftEngine } from "./engine";
import type { DraftEngineConfig, DraftEngineState } from "./types";

function createEngineWithLiveConfig<T>(configRef: { current: DraftEngineConfig<T> }): DraftEngine<T> {
  return new DraftEngine<T>({
    get id() {
      return configRef.current.id;
    },
    get conflictStrategy() {
      return configRef.current.conflictStrategy;
    },
    get debounceMs() {
      return configRef.current.debounceMs;
    },
    get merge() {
      return configRef.current.merge;
    },
    onFetch: () => configRef.current.onFetch(),
    onPush: (payload) => configRef.current.onPush(payload),
  });
}

export function useDraftEngine<T>(config: DraftEngineConfig<T>): {
  state: DraftEngineState<T>;
  update: (data: T) => void;
  retry: () => Promise<void>;
  initialize: () => Promise<void>;
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
    return engineRef.current.subscribe(setState);
  }, [config.id]);

  const initialize = useCallback(async () => {
    await engineRef.current?.initialize();
  }, []);

  const update = useCallback((data: T) => {
    engineRef.current?.update(data);
  }, []);

  const retry = useCallback(async () => {
    await engineRef.current?.retry();
  }, []);

  return { state, update, retry, initialize };
}
