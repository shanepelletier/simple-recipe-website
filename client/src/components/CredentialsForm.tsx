import { useState } from "react";
import type { ReactNode, SubmitEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { asApiError } from "../core/client";
import { safeNext } from "../core/next";

interface Props {
  title: string;
  submitLabel: string;
  pendingLabel: string;
  /** signIn or signUp — the only behaviour that differs between the two pages. */
  action: (username: string, password: string) => Promise<void>;
  /** "current-password" signing in, "new-password" registering, so browsers
   *  offer to fill on one and to generate on the other. */
  passwordAutoComplete: "current-password" | "new-password";
  footer: ReactNode;
}

// Sign in and register are the same form with a different verb, so they are
// one component rather than two near-copies that drift apart the first time
// the error handling changes.
export function CredentialsForm({
  title,
  submitLabel,
  pendingLabel,
  action,
  passwordAutoComplete,
  footer,
}: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); // or the browser navigates and the form is lost
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    setFormError("");

    try {
      await action(username, password);
      // replace: keeps /login out of history, so Back from the page you just
      // reached doesn't return you to a form you have already used.
      navigate(safeNext(searchParams.get("next")), { replace: true });
    } catch (reason) {
      const failure = asApiError(reason);
      // The API always answers with { error, fields } — one code path.
      setFieldErrors(failure.fields);
      setFormError(failure.message);
    } finally {
      // In `finally`, not in the `catch`: a spinner that runs forever after a
      // failed request is the classic bug in this kind of form, and this way
      // the reset survives an early return or a second failure branch being
      // added later.
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      <h1>{title}</h1>

      {formError !== "" && <p role="alert">{formError}</p>}

      <label>
        Username
        <input
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <FieldErrors messages={fieldErrors.username} />

      <label>
        Password
        <input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={passwordAutoComplete}
          required
        />
      </label>
      <FieldErrors messages={fieldErrors.password} />

      <button type="submit" disabled={submitting}>
        {submitting ? pendingLabel : submitLabel}
      </button>

      <p>{footer}</p>
    </form>
  );
}

function FieldErrors({ messages }: { messages?: string[] }) {
  if (messages === undefined || messages.length === 0) {
    return null;
  }
  return (
    <ul>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}
