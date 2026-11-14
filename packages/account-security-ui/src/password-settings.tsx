"use client";

import {
  createPasswordManagementClient,
  PasswordManagementClientError,
} from "@app-tour/session-client";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { normalizeOtpDigits } from "./normalize-otp-digits";

export type PasswordSettingsLabels = {
  readonly title: string;
  readonly create: string;
  readonly change: string;
  readonly requestOtp: string;
  readonly retry: string;
  readonly resend: string;
  readonly otp: string;
  readonly otpHint: string;
  readonly password: string;
  readonly confirm: string;
  readonly hint: string;
  readonly save: string;
  readonly loading: string;
  readonly saved: string;
  readonly mismatch: string;
  readonly show: string;
  readonly hide: string;
  readonly cancel: string;
  readonly error: (code: string) => string;
};

type Props = {
  readonly basePath: "/api/me/password" | "/api/identity/me/password";
  readonly labels: PasswordSettingsLabels;
};

export function PasswordSettings({ basePath, labels }: Props) {
  const client = useMemo(() => createPasswordManagementClient(basePath), [basePath]);
  const id = useId();
  const [availability, setAvailability] = useState<"loading" | "ready" | "disabled" | "error">(
    "loading"
  );
  const [retry, setRetry] = useState(0);
  const [hasPassword, setHasPassword] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [otpLength, setOtpLength] = useState<4 | 6>(4);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let active = true;
    void client
      .hasPassword()
      .then((value) => {
        if (active) {
          setHasPassword(value);
          setAvailability("ready");
        }
      })
      .catch((failure: unknown) => {
        if (!active) return;
        const code =
          failure instanceof PasswordManagementClientError ? failure.code : "BACKEND_UNREACHABLE";
        if (code === "PASSWORD_AUTH_DISABLED") setAvailability("disabled");
        else {
          setError(code);
          setAvailability("error");
        }
      });
    return () => {
      active = false;
    };
  }, [client, retry]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function clearForm(): void {
    setChallengeId("");
    setOtp("");
    setPassword("");
    setConfirm("");
    setError(null);
    setShow(false);
  }
  async function requestOtp(): Promise<void> {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await client.requestOtp();
      setChallengeId(result.challengeId);
      setOtpLength(result.otpLength);
      setOtp("");
      setCooldown(45);
    } catch (failure) {
      setError(
        failure instanceof PasswordManagementClientError ? failure.code : "BACKEND_UNREACHABLE"
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("PASSWORD_CONFIRM_MISMATCH");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await client.setPassword({ challengeId, otp, password });
      clearForm();
      setHasPassword(true);
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof PasswordManagementClientError ? failure.code : "BACKEND_UNREACHABLE"
      );
    } finally {
      setBusy(false);
    }
  }

  if (availability === "loading" || availability === "disabled") return null;
  if (availability === "error")
    return (
      <section data-account-password-settings aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`}>{labels.title}</h2>
        <p>{labels.otpHint}</p>
        <p role="alert">{labels.error(error ?? "BACKEND_UNREACHABLE")}</p>
        <button
          type="button"
          onClick={() => {
            setAvailability("loading");
            setRetry((value) => value + 1);
          }}
        >
          {labels.retry}
        </button>
      </section>
    );
  return (
    <section
      data-account-password-settings
      className="space-y-3 rounded-md border p-4"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>{labels.title}</h2>
      <p>{labels.otpHint}</p>
      {saved ? <p role="status">{labels.saved}</p> : null}
      {challengeId === "" ? (
        <button type="button" disabled={busy || cooldown > 0} onClick={() => void requestOtp()}>
          {busy
            ? labels.loading
            : `${hasPassword ? labels.change : labels.create}${cooldown > 0 ? ` (${cooldown})` : ""}`}
        </button>
      ) : (
        <form onSubmit={(event) => void save(event)} className="space-y-3">
          <label htmlFor={`${id}-otp`}>{labels.otp}</label>
          <input
            id={`${id}-otp`}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            maxLength={otpLength}
            onChange={(event) => {
              setOtp(normalizeOtpDigits(event.target.value).slice(0, otpLength));
              setError(null);
            }}
          />
          <label htmlFor={`${id}-password`}>{labels.password}</label>
          <input
            id={`${id}-password`}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            maxLength={256}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
          <label htmlFor={`${id}-confirm`}>{labels.confirm}</label>
          <input
            id={`${id}-confirm`}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            maxLength={256}
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setError(null);
            }}
          />
          <button type="button" aria-pressed={show} onClick={() => setShow((value) => !value)}>
            {show ? labels.hide : labels.show}
          </button>
          <p>{labels.hint}</p>
          <button
            type="submit"
            disabled={busy || otp.length !== otpLength || !password || !confirm}
          >
            {busy ? labels.loading : labels.save}
          </button>
          <button type="button" disabled={busy || cooldown > 0} onClick={() => void requestOtp()}>
            {cooldown > 0 ? `${labels.resend} (${cooldown})` : labels.resend}
          </button>
          <button type="button" disabled={busy} onClick={clearForm}>
            {labels.cancel}
          </button>
        </form>
      )}
      {error !== null ? (
        <p role="alert">
          {error === "PASSWORD_CONFIRM_MISMATCH" ? labels.mismatch : labels.error(error)}
        </p>
      ) : null}
    </section>
  );
}
