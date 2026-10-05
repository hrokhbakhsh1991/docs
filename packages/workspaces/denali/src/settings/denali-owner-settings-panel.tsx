"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

export const DENALI_OWNER_SETTINGS_HTTP_PATH = "/settings/config/payment_destination" as const;

type Props = {
  readonly apiBaseUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly labels: {
    readonly title: string;
    readonly loadError: (status: number) => string;
  };
};

type Payload = {
  enabled: boolean;
  cardNumber: string;
  cardHolderName: string;
  bankName: string | null;
  instructions: string | null;
};

export function WorkspaceOwnerSettingsPanel({ apiBaseUrl, headers, labels }: Props) {
  const [payload, setPayload] = useState<Payload>({
    enabled: false,
    cardNumber: "",
    cardHolderName: "",
    bankName: null,
    instructions: null,
  });
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl}${DENALI_OWNER_SETTINGS_HTTP_PATH}`, {
      headers,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(labels.loadError(response.status));
        const body = (await response.json()) as { payload?: Partial<Payload> };
        setPayload((current) => ({ ...current, ...body.payload }));
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : labels.loadError(500));
        setStatus("error");
      });
  }, [apiBaseUrl, headers, labels]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}${DENALI_OWNER_SETTINGS_HTTP_PATH}`, {
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ configVersion: 1, payload }),
      });
      if (!response.ok) throw new Error(labels.loadError(response.status));
      setStatus("saved");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : labels.loadError(500));
      setStatus("error");
    }
  }

  return (
    <section data-denali-payment-destination-settings data-workspace-owner-settings-panel>
      <h1>{labels.title}</h1>
      {status === "loading" ? <p role="status">Loading…</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
      <form onSubmit={save}>
        <label>
          <input
            type="checkbox"
            checked={payload.enabled}
            onChange={(event) => setPayload({ ...payload, enabled: event.target.checked })}
          />
          Enable card-to-card payment
        </label>
        <label>
          Card number
          <input
            name="cardNumber"
            inputMode="numeric"
            autoComplete="off"
            value={payload.cardNumber}
            onChange={(event) => setPayload({ ...payload, cardNumber: event.target.value })}
          />
        </label>
        <label>
          Card holder name
          <input
            name="cardHolderName"
            value={payload.cardHolderName}
            onChange={(event) => setPayload({ ...payload, cardHolderName: event.target.value })}
          />
        </label>
        <label>
          Bank name
          <input
            name="bankName"
            value={payload.bankName ?? ""}
            onChange={(event) => setPayload({ ...payload, bankName: event.target.value })}
          />
        </label>
        <label>
          Instructions
          <textarea
            name="instructions"
            value={payload.instructions ?? ""}
            onChange={(event) => setPayload({ ...payload, instructions: event.target.value })}
          />
        </label>
        <button type="submit" disabled={status === "saving" || status === "loading"}>
          {status === "saving" ? "Saving…" : "Save payment destination"}
        </button>
        {status === "saved" ? <p role="status">Saved</p> : null}
      </form>
    </section>
  );
}
