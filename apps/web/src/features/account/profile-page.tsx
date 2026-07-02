import { useAuthStore } from "@/stores/auth.store";

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <section className="max-w-3xl rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">Personal center</h2>
      <dl className="mt-5 grid grid-cols-[160px_1fr] gap-3 text-sm">
        <dt className="text-muted-foreground">Display name</dt>
        <dd>{user?.displayName ?? "Super Administrator"}</dd>
        <dt className="text-muted-foreground">Username</dt>
        <dd>{user?.username ?? "admin"}</dd>
        <dt className="text-muted-foreground">Language</dt>
        <dd>{user?.language ?? "en"}</dd>
      </dl>
    </section>
  );
}
