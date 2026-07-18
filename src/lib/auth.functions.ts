import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type PortalRole = "student" | "tutor";

export const signInForPortal = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; role: PortalRole }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    const password = String(input?.password ?? "");
    const role = input?.role;
    if (!email || !password || (role !== "student" && role !== "tutor")) {
      throw new Error("Invalid sign-in request");
    }
    return { email, password, role };
  })
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    if (!url || !key) throw new Error("Authentication is not configured");

    const authClient = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (signInError || !signIn.user || !signIn.session) {
      return { ok: false as const, message: signInError?.message ?? "Invalid email or password" };
    }

    const userClient = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });

    const [{ data: profile, error: profileError }, { data: roleRows, error: rolesError }] = await Promise.all([
      userClient.from("profiles").select("id,status,deleted_at").eq("id", signIn.user.id).maybeSingle(),
      userClient.from("user_roles").select("role").eq("user_id", signIn.user.id),
    ]);

    if (profileError) return { ok: false as const, message: profileError.message };
    if (rolesError) return { ok: false as const, message: rolesError.message };

    const roles = (roleRows ?? []).map((row) => row.role);
    const activeProfile = !!profile && profile.status === "active" && !profile.deleted_at;
    if (!activeProfile || !roles.includes(data.role)) {
      await authClient.auth.signOut();
      return {
        ok: false as const,
        message: data.role === "student"
          ? "This account is not registered as a Student. Please register as a Student first."
          : "This account is not registered as a Tutor. Please complete Tutor registration first.",
      };
    }

    return { ok: true as const, session: signIn.session, user: signIn.user, roles };
  });