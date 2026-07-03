import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateOwnAvatarRequestSchema,
  updateOwnProfileRequestSchema,
  type UpdateOwnProfileRequest
} from "@web-admin-base/contracts";
import { AlertCircle, Loader2, RefreshCw, Save } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  fetchProfile,
  updateOwnAvatar,
  updateOwnProfile,
  type Profile,
  type ProfileUser
} from "@/features/account/profile-api";
import { useAuthStore } from "@/stores/auth.store";

type ProfileFormValues = {
  displayName: string;
  email: string;
  phone: string;
  avatarFileId: string;
  gender: string;
  employeeNumber: string;
};

export function ProfilePage() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });
  const profileMutation = useMutation({
    mutationFn: updateOwnProfile,
    onSuccess: async (profile) => {
      updateUser({
        displayName: profile.user.displayName,
        language: profile.preferences.language
      });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  });
  const avatarMutation = useMutation({
    mutationFn: updateOwnAvatar,
    onSuccess: async (profile) => {
      updateUser({ displayName: profile.user.displayName });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  });

  if (query.isLoading) {
    return <ProfileState icon={<Loader2 className="size-5 animate-spin" />} title="Loading profile" />;
  }

  if (query.isError || !query.data) {
    return (
      <ProfileState
        action={
          <Button onClick={() => void query.refetch()} size="sm" variant="outline">
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
        icon={<AlertCircle className="size-5 text-destructive" />}
        title="Profile could not be loaded"
      />
    );
  }

  return (
    <section className="grid max-w-5xl gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <ProfileForm
        busy={profileMutation.isPending || avatarMutation.isPending}
        onAvatarSubmit={(avatarFileId) =>
          avatarMutation.mutate(updateOwnAvatarRequestSchema.parse({ avatarFileId }))
        }
        onSubmit={(input) => profileMutation.mutate(updateOwnProfileRequestSchema.parse(input))}
        profile={query.data}
      />
      <ProfileSummary profile={query.data} />
    </section>
  );
}

function ProfileForm({
  busy,
  onAvatarSubmit,
  onSubmit,
  profile
}: {
  busy: boolean;
  onAvatarSubmit: (avatarFileId: string | null) => void;
  onSubmit: (input: UpdateOwnProfileRequest) => void;
  profile: Profile;
}) {
  const form = useForm({
    defaultValues: toProfileFormValues(profile.user),
    onSubmit: ({ value }) =>
      onSubmit({
        displayName: value.displayName,
        email: value.email,
        phone: value.phone,
        avatarFileId: value.avatarFileId.trim() ? value.avatarFileId.trim() : null,
        gender: value.gender.trim() ? value.gender.trim() : null,
        employeeNumber: value.employeeNumber.trim() ? value.employeeNumber.trim() : null
      })
  });

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Personal center</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your own profile fields.</p>
        </div>
        <Button disabled={busy} form="profile-form" size="sm" type="submit">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Save
        </Button>
      </div>
      <form
        className="mt-5 grid gap-4 md:grid-cols-2"
        id="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <ReadonlyField label="Username" value={profile.user.username} />
        <form.Field
          name="displayName"
          children={(field) => (
            <TextField label="Display name" onBlur={field.handleBlur} onChange={field.handleChange} value={field.state.value} />
          )}
        />
        <form.Field
          name="email"
          children={(field) => (
            <TextField label="Email" onBlur={field.handleBlur} onChange={field.handleChange} type="email" value={field.state.value} />
          )}
        />
        <form.Field
          name="phone"
          children={(field) => (
            <TextField label="Phone" onBlur={field.handleBlur} onChange={field.handleChange} value={field.state.value} />
          )}
        />
        <form.Field
          name="gender"
          children={(field) => (
            <TextField label="Gender" onBlur={field.handleBlur} onChange={field.handleChange} value={field.state.value} />
          )}
        />
        <form.Field
          name="employeeNumber"
          children={(field) => (
            <TextField label="Employee number" onBlur={field.handleBlur} onChange={field.handleChange} value={field.state.value} />
          )}
        />
        <form.Field
          name="avatarFileId"
          children={(field) => (
            <div className="md:col-span-2">
              <TextField label="Avatar file ID" onBlur={field.handleBlur} onChange={field.handleChange} value={field.state.value} />
              <Button
                className="mt-2"
                disabled={busy}
                onClick={() => onAvatarSubmit(field.state.value.trim() ? field.state.value.trim() : null)}
                size="sm"
                type="button"
                variant="outline"
              >
                Set avatar
              </Button>
            </div>
          )}
        />
      </form>
    </section>
  );
}

function ProfileSummary({ profile }: { profile: Profile }) {
  return (
    <aside className="rounded-lg border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold">Current preferences</h3>
      <dl className="mt-4 grid grid-cols-[120px_1fr] gap-3 text-sm">
        <dt className="text-muted-foreground">Language</dt>
        <dd>{profile.preferences.language}</dd>
        <dt className="text-muted-foreground">Theme</dt>
        <dd>{profile.preferences.themeMode}</dd>
        <dt className="text-muted-foreground">Color</dt>
        <dd>{profile.preferences.themeColor}</dd>
        <dt className="text-muted-foreground">Page tabs</dt>
        <dd>{profile.preferences.pageTabsEnabled ? "Enabled" : "Disabled"}</dd>
        <dt className="text-muted-foreground">Updated</dt>
        <dd>{profile.preferences.updatedAt || "-"}</dd>
      </dl>
    </aside>
  );
}

function TextField({
  label,
  onBlur,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border bg-background px-3"
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-muted-foreground">
      {label}
      <input className="h-10 rounded-md border bg-muted px-3 text-foreground" readOnly value={value} />
    </label>
  );
}

function ProfileState({
  action,
  icon,
  title
}: {
  action?: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="max-w-3xl rounded-lg border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">{icon}</div>
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

function toProfileFormValues(user: ProfileUser): ProfileFormValues {
  return {
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    avatarFileId: user.avatarFileId ?? "",
    gender: user.gender ?? "",
    employeeNumber: user.employeeNumber ?? ""
  };
}
