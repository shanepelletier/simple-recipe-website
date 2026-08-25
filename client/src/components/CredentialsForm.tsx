import { useState } from "react";
import type { SubmitEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { useAuth } from "../core/auth-context";
import { asApiError } from "../core/client";
import { nextDestination, safeNext } from "../core/next";

interface Props {
  title: string;
  submitLabel: string;
  pendingLabel: string;
  /** signIn or signUp — the only behaviour that differs between the two pages. */
  action: (username: string, password: string) => Promise<void>;
  /** "current-password" signing in, "new-password" registering, so browsers
   *  offer to fill on one and to generate on the other. */
  passwordAutoComplete: "current-password" | "new-password";
  /** The other credentials page. Named rather than passed as a finished link,
   *  because where it points depends on `next` and only this component has it. */
  alternate: { to: string; label: string };
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
  alternate,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read once and used three times: to redirect after signing in, to say where
  // that will be, and to hand the same destination to the other page — the
  // whole point of arriving here from a guard is that it survives the detour.
  const next = safeNext(searchParams.get("next"));
  const destination = nextDestination(next);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");

  // Already signed in — Back, a stale bookmark, a shared link. RequireAuth
  // only ever bounces the other direction (anonymous out of a guarded page),
  // so nothing else catches this: without it, alice sees a sign-in form she
  // cannot use for anything, with her own name still sitting in the header.
  // Sent to the same place a fresh sign-in would have gone, not to the grid
  // unconditionally, so a guard's detour still resolves correctly.
  if (user !== null) {
    return <Navigate to={next} replace />;
  }

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
      navigate(next, { replace: true });
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
    <form className="auth" onSubmit={onSubmit} noValidate={false}>
      {/* The heading and the line under it are one group, so the subtitle sits
          against the title rather than at the form's own rhythm. */}
      <div className="auth__heading">
        <h1 className="auth__title">{title}</h1>
        {/* Nothing said the guard had bounced you here — you clicked Shopping
            list and got a sign-in form with no explanation. */}
        {destination !== null && <p className="auth__intro">{destination}</p>}
      </div>

      {formError !== "" && <p role="alert">{formError}</p>}

      {/* Each field is a label and the errors it produced, wrapped together:
          a message about the password belongs to the password box, not to the
          form's own spacing rhythm. */}
      <div className="auth__field">
        <label>
          Username
          <input
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            // The whole page is this form, so there is nothing else the caret
            // could sensibly be in on arrival.
            autoFocus
            required
            aria-invalid={fieldErrors.username === undefined ? undefined : true}
            aria-describedby={fieldErrors.username === undefined ? undefined : "username-errors"}
          />
        </label>
        <FieldErrors id="username-errors" messages={fieldErrors.username} />
      </div>

      <div className="auth__field">
        <label>
          Password
          <input
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={passwordAutoComplete}
            required
            aria-invalid={fieldErrors.password === undefined ? undefined : true}
            aria-describedby={fieldErrors.password === undefined ? undefined : "password-errors"}
          />
        </label>
        <FieldErrors id="password-errors" messages={fieldErrors.password} />
      </div>

      <button type="submit" className="auth__submit" disabled={submitting}>
        {submitting ? pendingLabel : submitLabel}
      </button>

      {/* Carries `next` across. Without it, a visitor bounced here from the
          shopping list who turns out to need an account signs up and lands on
          the grid — the destination surviving the detour to sign-in but not the
          one further step to register. */}
      <p className="auth__footer">
        <Link to={next === "/" ? alternate.to : `${alternate.to}?next=${encodeURIComponent(next)}`}>
          {alternate.label}
        </Link>
      </p>
    </form>
  );
}

function FieldErrors({ id, messages }: { id?: string; messages?: string[] }) {
  if (messages === undefined || messages.length === 0) {
    return null;
  }
  return (
    <ul id={id} className="field-errors" role="alert">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}
