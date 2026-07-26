import { FormEvent } from "react";

import { AuthenticationMode } from "../session";

type AuthPageProps = {
  email: string;
  password: string;
  message: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onAuthenticate: (event: FormEvent, mode: AuthenticationMode) => void;
};

export function AuthPage({ email, password, message, onEmailChange, onPasswordChange, onAuthenticate }: AuthPageProps) {
  return <section className="page-panel auth-page">
    <p className="eyebrow">SANITIZED DEMO ONLY</p>
    <h2>Register or sign in</h2>
    <p>Use only a local demo account. Passwords must have at least 6 characters.</p>
    <form onSubmit={(event) => onAuthenticate(event, "sign-in")}>
      <label htmlFor="auth-email">Email</label>
      <input id="auth-email" aria-label="Email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="demo@example.test" required />
      <label htmlFor="auth-password">Password</label>
      <input id="auth-password" aria-label="Password" type="password" minLength={6} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="6+ character password" required />
      <div className="button-row"><button>Sign in</button><button type="button" onClick={(event) => onAuthenticate(event, "register")}>Register</button></div>
    </form>
    <p className="message">{message}</p>
  </section>;
}
