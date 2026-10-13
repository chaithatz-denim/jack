"use client";

import { useActionState } from "react";
import { signInAction } from "@/lib/supabase/user-actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, undefined);
  return <main className="login-screen" id="loginScreen">
    <section className="login-card">
      <div className="login-brand">
        <div className="brand-logo-wrap"><img className="brand-logo" src="/assets/jack-russel-logo-white.png" alt="JACK RUSSEL"/></div>
        <div><h1>PRODUCTION CONTROL</h1><p>JACK RUSSEL · Sample tracking</p></div>
      </div>
      <form className="login-form" action={formAction}>
        <label className="field"><span>User name</span><input name="username" autoComplete="username" required/></label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required/></label>
        <div className="error">{state?.error ?? ""}</div>
        <button className="btn primary login-submit" disabled={pending} type="submit">{pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบควบคุมการผลิต"}</button>
      </form>
    </section>
  </main>;
}
