import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api/auth";
import { orgApi } from "@/lib/api/organizations";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  isGuest: boolean;
};

type AuthStore = {
  user: User | null;
  token: string | null;
  currentOrgId: string | null;
  isLoading: boolean;
  setCurrentOrgId: (id: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    orgName: string
  ) => Promise<void>;
  continueAsGuest: () => void;
  signOut: () => void;
};

function deriveInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentOrgId: null,
      isLoading: false,

      setCurrentOrgId: (id) => set({ currentOrgId: id }),

      signIn: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          // 1. Obtain token
          const { access_token } = await authApi.login(email, password);
          localStorage.setItem("aiwos-token", access_token);

          // 2. Fetch authenticated user profile
          const me = await authApi.me();
          const name = me.full_name ?? email.split("@")[0];

          // 3. Resolve first organisation (or null if none exist yet)
          let currentOrgId: string | null = null;
          try {
            const orgs = await orgApi.list();
            currentOrgId = orgs[0]?.id ?? null;
          } catch {
            // Non-fatal — user just has no orgs yet
          }

          set({
            token: access_token,
            currentOrgId,
            user: {
              id: me.id,
              name,
              email: me.email,
              role: "Admin",
              initials: deriveInitials(name),
              isGuest: false,
            },
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      signUp: async (
        firstName: string,
        lastName: string,
        email: string,
        password: string,
        orgName: string
      ) => {
        set({ isLoading: true });
        try {
          const full_name = `${firstName} ${lastName}`.trim();

          // 1. Register account
          await authApi.register(email, password, full_name);

          // 2. Login to obtain token — if this fails the user was created but
          //    we cannot complete setup. Throw a typed error so the UI can
          //    redirect to the sign-in tab instead of leaving the form broken.
          let access_token: string;
          try {
            const result = await authApi.login(email, password);
            access_token = result.access_token;
          } catch {
            set({ isLoading: false });
            const err = new Error("Account created. Please sign in to continue.");
            (err as Error & { redirectToSignIn: boolean }).redirectToSignIn = true;
            throw err;
          }
          localStorage.setItem("aiwos-token", access_token);

          // 3. Fetch profile
          const me = await authApi.me();

          // 4. Create the organisation
          const slug =
            slugify(orgName) ||
            slugify(full_name) ||
            `org-${Date.now()}`;
          let org;
          try {
            org = await orgApi.create(orgName, slug);
          } catch {
            // Slug collision — append timestamp and retry once
            org = await orgApi.create(orgName, `${slug}-${Date.now()}`);
          }

          set({
            token: access_token!,
            currentOrgId: org.id,
            user: {
              id: me.id,
              name: full_name,
              email: me.email,
              role: "Admin",
              initials: deriveInitials(full_name),
              isGuest: false,
            },
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      continueAsGuest: () => {
        set({
          user: {
            id: "guest",
            name: "Guest",
            email: "",
            role: "Guest",
            initials: "G",
            isGuest: true,
          },
          token: null,
          currentOrgId: null,
        });
      },

      signOut: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("aiwos-token");
        }
        set({ user: null, token: null, currentOrgId: null });
      },
    }),
    {
      name: "aiwos-auth",
      // Restore the dedicated token key on hydration so the API client
      // can find it immediately (before any React render).
      onRehydrateStorage: () => (state) => {
        if (state?.token && typeof window !== "undefined") {
          localStorage.setItem("aiwos-token", state.token);
        }
      },
    }
  )
);
