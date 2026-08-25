import { CredentialsForm } from "../components/CredentialsForm";
import { useAuth } from "../core/auth-context";

export default function Register() {
  const { signUp } = useAuth();

  return (
    <CredentialsForm
      title="Register"
      submitLabel="Create account"
      pendingLabel="Creating account…"
      passwordAutoComplete="new-password"
      action={signUp}
      alternate={{ to: "/login", label: "Already have an account?" }}
    />
  );
}
