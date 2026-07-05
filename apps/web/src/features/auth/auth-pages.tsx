import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { changeOwnPassword, loginWithPassword } from "@/lib/api-client";
import { translate } from "@/i18n/messages";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const passwordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

export function LoginPage() {
  const navigate = useNavigate();
  const language = useLayoutStore((state) => state.language);
  const signIn = useAuthStore((state) => state.signIn);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm({
    defaultValues: { username: "admin", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      const result = await loginWithPassword(value);
      signIn(result);
      await navigate({ to: result.user.forcePasswordChange ? "/forced-password-change" : "/" });
    }
  });

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 p-6">
      <section className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">{translate(language, "auth.login")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Username and password authentication.</p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="username"
            children={(field) => (
              <div>
                <label className="block text-sm font-medium" htmlFor="login-username">
                  Username
                </label>
                <span className="mt-2 flex h-10 items-center gap-2 rounded-md border bg-background px-3">
                  <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    autoComplete="username"
                    className="w-full bg-transparent outline-none"
                    id="login-username"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </span>
              </div>
            )}
          />
          <form.Field
            name="password"
            children={(field) => (
              <div>
                <label className="block text-sm font-medium" htmlFor="login-password">
                  Password
                </label>
                <span className="mt-2 flex h-10 items-center gap-2 rounded-md border bg-background px-3">
                  <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    autoComplete="current-password"
                    className="w-full bg-transparent outline-none"
                    id="login-password"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    value={field.state.value}
                  />
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </div>
            )}
          />
          <Button className="w-full" type="submit">
            {translate(language, "actions.login")}
          </Button>
        </form>
      </section>
    </main>
  );
}

export function ForcedPasswordChangePage() {
  return <PasswordChangeForm forced />;
}

export function PasswordChangePage() {
  return <PasswordChangeForm />;
}

function PasswordChangeForm({ forced = false }: { forced?: boolean }) {
  const navigate = useNavigate();
  const language = useLayoutStore((state) => state.language);
  const markPasswordChanged = useAuthStore((state) => state.markPasswordChanged);
  const signOut = useAuthStore((state) => state.signOut);
  const form = useForm({
    defaultValues: { oldPassword: "", newPassword: "" },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value }) => {
      await changeOwnPassword(value);
      markPasswordChanged();
      signOut();
      await navigate({ to: "/login" });
    }
  });

  return (
    <section className="mx-auto max-w-xl rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">
        {forced ? translate(language, "auth.forcedPasswordChange") : translate(language, "auth.changePassword")}
      </h2>
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="oldPassword"
          children={(field) => (
            <label className="block text-sm font-medium">
              Current password
              <input
                autoComplete="current-password"
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                type="password"
                value={field.state.value}
              />
            </label>
          )}
        />
        <form.Field
          name="newPassword"
          children={(field) => (
            <label className="block text-sm font-medium">
              New password
              <input
                autoComplete="new-password"
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                type="password"
                value={field.state.value}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Minimum 8 characters with letters and numbers.
              </span>
            </label>
          )}
        />
        <Button type="submit">{translate(language, "actions.save")}</Button>
      </form>
    </section>
  );
}
