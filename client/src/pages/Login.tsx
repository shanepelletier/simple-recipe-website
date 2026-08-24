import { CredentialsForm } from "../components/CredentialsForm";
import { useAuth } from "../core/auth-context";

export default function Login() {
  const { signIn } = useAuth();

  return (
    <CredentialsForm
      title="Sign in"
      submitLabel="Sign in"
      pendingLabel="Signing in…"
      passwordAutoComplete="current-password"
      action={signIn}
      alternate={{ to: "/register", label: "Need an account?" }}
    />
  );
}
