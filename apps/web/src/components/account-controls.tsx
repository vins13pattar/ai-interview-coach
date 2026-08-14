"use client";

import type { AccountProfile, RecoveryKit } from "@interview-coach/contracts";
import { FormEvent, useEffect, useState } from "react";

const clientHeaders = {
  "content-type": "application/json",
  "x-interview-coach-client": "web",
};

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      body.error ?? "The account request could not be completed.",
    );
  }
  return body as T;
}

export function AccountControls() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [recoveryKit, setRecoveryKit] = useState<RecoveryKit | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [accountHandle, setAccountHandle] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/account", { cache: "no-store" })
      .then((response) => responseJson<{ profile: AccountProfile }>(response))
      .then(({ profile: nextProfile }) => {
        if (active) setProfile(nextProfile);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Account status is unavailable.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function runAction<T>(
    action: string,
    request: () => Promise<T>,
  ): Promise<T | null> {
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      return await request();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The account request could not be completed.",
      );
      return null;
    } finally {
      setBusyAction(null);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kit = await runAction("register", async () => {
      const response = await fetch("/api/v1/account", {
        method: "POST",
        headers: clientHeaders,
        body: JSON.stringify({ displayName }),
      });
      return responseJson<RecoveryKit>(response);
    });
    if (kit) {
      setProfile(kit.profile);
      setRecoveryKit(kit);
      setDisplayName("");
      setNotice("Account registered. Save the recovery kit shown below now.");
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const signedIn = await runAction("sign-in", async () => {
      const response = await fetch("/api/v1/account/sign-in", {
        method: "POST",
        headers: clientHeaders,
        body: JSON.stringify({ accountHandle, recoveryCode }),
      });
      await responseJson<{ signedIn: true }>(response);
      return true;
    });
    if (signedIn) window.location.reload();
  }

  async function signOut() {
    const signedOut = await runAction("sign-out", async () => {
      const response = await fetch("/api/v1/account/sign-out", {
        method: "POST",
        headers: { "x-interview-coach-client": "web" },
      });
      if (!response.ok) await responseJson(response);
      return true;
    });
    if (signedOut) window.location.reload();
  }

  async function rotateRecovery() {
    const kit = await runAction("rotate", async () => {
      const response = await fetch("/api/v1/account/recovery", {
        method: "POST",
        headers: clientHeaders,
        body: JSON.stringify({ confirmation: "ROTATE" }),
      });
      return responseJson<RecoveryKit>(response);
    });
    if (kit) {
      setRecoveryKit(kit);
      setNotice("Recovery code rotated. The previous code no longer works.");
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const deleted = await runAction("delete", async () => {
      const response = await fetch("/api/v1/account", {
        method: "DELETE",
        headers: clientHeaders,
        body: JSON.stringify({
          recoveryCode,
          confirmation: deleteConfirmation,
        }),
      });
      if (!response.ok) await responseJson(response);
      return true;
    });
    if (deleted) window.location.reload();
  }

  async function copyRecoveryKit() {
    if (!recoveryKit) return;
    try {
      await navigator.clipboard.writeText(
        `Interview Coach recovery kit\nAccount: ${recoveryKit.profile.accountHandle}\nRecovery code: ${recoveryKit.recoveryCode}\n`,
      );
      setNotice("Recovery kit copied. Store it in a password manager.");
    } catch {
      setError("Copy failed. Select and copy both values manually.");
    }
  }

  return (
    <section className="account-panel" aria-labelledby="account-heading">
      <div className="account-intro">
        <p className="step-label">Optional account</p>
        <h3 id="account-heading">Keep your practice history.</h3>
        <p>
          Guest practice works immediately. Register with a recovery code to
          return on another device—no email address or password required.
        </p>
      </div>

      <div className="account-actions" aria-busy={busyAction !== null}>
        {!profile ? <p>Checking this workspace…</p> : null}

        {profile?.kind === "guest" ? (
          <div className="account-columns">
            <form onSubmit={register}>
              <h4>Register this workspace</h4>
              <label>
                Display name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={busyAction !== null}
              >
                {busyAction === "register"
                  ? "Registering…"
                  : "Get recovery kit"}
              </button>
            </form>

            <form onSubmit={signIn}>
              <h4>Return to an account</h4>
              <p className="account-warning">
                Signing in switches this browser away from its current guest
                workspace.
              </p>
              <label>
                Account handle
                <input
                  value={accountHandle}
                  onChange={(event) => setAccountHandle(event.target.value)}
                  pattern="aic_[a-z0-9]{16}"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Recovery code
                <input
                  type="password"
                  value={recoveryCode}
                  onChange={(event) => setRecoveryCode(event.target.value)}
                  pattern="aicr_[A-Za-z0-9_-]{32}"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button
                className="button button-secondary"
                type="submit"
                disabled={busyAction !== null}
              >
                {busyAction === "sign-in" ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        ) : null}

        {profile?.kind === "registered" ? (
          <div className="registered-account">
            <div>
              <span>Signed in as</span>
              <strong>{profile.displayName}</strong>
              <code>{profile.accountHandle}</code>
            </div>
            <div className="registered-account-buttons">
              <button
                className="button button-secondary"
                type="button"
                onClick={rotateRecovery}
                disabled={busyAction !== null}
              >
                {busyAction === "rotate" ? "Rotating…" : "Rotate recovery code"}
              </button>
              <button
                className="session-action"
                type="button"
                onClick={signOut}
                disabled={busyAction !== null}
              >
                Sign out
              </button>
            </div>
            <details className="danger-zone">
              <summary>Delete account and practice data</summary>
              <form onSubmit={deleteAccount}>
                <p>
                  This permanently deletes this account and its saved sessions.
                </p>
                <label>
                  Recovery code
                  <input
                    type="password"
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  Type DELETE MY ACCOUNT
                  <input
                    value={deleteConfirmation}
                    onChange={(event) =>
                      setDeleteConfirmation(event.target.value)
                    }
                    pattern="DELETE MY ACCOUNT"
                    required
                  />
                </label>
                <button
                  className="button button-danger"
                  type="submit"
                  disabled={busyAction !== null}
                >
                  {busyAction === "delete" ? "Deleting…" : "Delete permanently"}
                </button>
              </form>
            </details>
          </div>
        ) : null}

        {recoveryKit ? (
          <div className="recovery-kit" role="status">
            <strong>Save this once-only recovery kit</strong>
            <span>Account handle</span>
            <code>{recoveryKit.profile.accountHandle}</code>
            <span>Recovery code</span>
            <code>{recoveryKit.recoveryCode}</code>
            <p>
              The recovery code is not stored in readable form and cannot be
              retrieved later. Put it in a password manager before leaving.
            </p>
            <button
              className="button button-secondary"
              type="button"
              onClick={copyRecoveryKit}
            >
              Copy recovery kit
            </button>
          </div>
        ) : null}

        {notice ? <p className="account-notice">{notice}</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
