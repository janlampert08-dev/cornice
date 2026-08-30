"use client";

import { useActionState, useRef } from "react";
import { uploadAvatar, type ProfileActionState } from "@/lib/actions/profile";
import Avatar from "@/components/Avatar";

const initialState: ProfileActionState = { error: null };

export default function AvatarUpload({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string | null;
}) {
  const [state, formAction, pending] = useActionState(uploadAvatar, initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <Avatar url={avatarUrl} name={name} size={56} />
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="file"
          name="avatar"
          id="avatar-input"
          accept="image/*"
          onChange={(e) => e.target.form?.requestSubmit()}
          className="sr-only"
        />
        <label
          htmlFor="avatar-input"
          className="cursor-pointer self-start rounded-xl border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:border-foreground"
        >
          {pending ? "Wird hochgeladen…" : "Profilbild ändern"}
        </label>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
