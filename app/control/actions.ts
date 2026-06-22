"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearAppContextSelection,
  getSession,
  setChurchAppContextSelection,
  setControlAppContextSelection,
  type ChurchRoleId,
} from "@/lib/auth";
import { resolveTenantViewTarget } from "@/lib/control-plane-routing";
import { logTenantViewAuditEvent } from "@/lib/tenant-view-audit";
import {
  shouldUseLocalControlPlaneFallback,
  queryControlPlaneLocalDb,
  createControlPlaneServerClient,
} from "@/lib/supabase/control-plane";
import {
  queryTenantLocalDb,
  createTenantAdminClient,
} from "@/lib/supabase/tenant";

function isChurchRoleId(value: string): value is ChurchRoleId {
  return (
    value === "church-admin" ||
    value === "secretary" ||
    value === "pastor" ||
    value === "ministry-leader" ||
    value === "member"
  );
}

export async function launchTenantViewAction(formData: FormData) {
  const session = await getSession("/control");

  if (!session || !session.canAccessControl) {
    throw new Error("Control-plane access is required.");
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const roleId = String(formData.get("roleId") ?? "church-admin");

  if (!tenantId || !isChurchRoleId(roleId)) {
    throw new Error("A valid tenant view target is required.");
  }

  const availableTenant = session.tenantViews.find(
    (entry) => entry.tenantId === tenantId,
  );

  if (!availableTenant) {
    throw new Error("That tenant is not available for viewing.");
  }

  const resolvedTarget = await resolveTenantViewTarget(tenantId);

  if (!resolvedTarget) {
    throw new Error(
      "Tenant routing is not available in preview mode. Start Supabase locally (npx supabase start) to launch a tenant view.",
    );
  }

  if (resolvedTarget.connectionStatus !== "ready") {
    throw new Error("That tenant connection is not ready yet.");
  }

  await setChurchAppContextSelection({
    churchId: resolvedTarget.church.id,
    roleId,
    source: "impersonation",
  });
  await logTenantViewAuditEvent({
    actorUserId: session.userId,
    churchId: resolvedTarget.church.id,
    roleId,
    eventType: "enter",
  });

  revalidatePath("/control");
  revalidatePath("/app");
  redirect(`/app/${roleId}`);
}

export async function returnToControlPlaneAction() {
  const session = await getSession("/control");

  if (!session || !session.canAccessControl) {
    throw new Error("Control-plane access is required.");
  }

  if (session.appContext.kind === "church") {
    await logTenantViewAuditEvent({
      actorUserId: session.userId,
      churchId: session.appContext.church.id,
      roleId: session.appContext.roleId,
      eventType: "exit",
    });
  }

  await clearAppContextSelection();
  await setControlAppContextSelection();

  revalidatePath("/control");
  revalidatePath("/app");
  redirect("/control");
}
export async function updateTenantAction(input: {
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  billingStatus: string;
}) {
  const session = await getSession("/control");
  if (!session || !session.canAccessControl) {
    throw new Error("Control-plane access is required.");
  }

  if (shouldUseLocalControlPlaneFallback()) {
    await queryControlPlaneLocalDb(
      `update public.tenants
       set name = $1, slug = $2, tenant_status = $3::public.tenant_status, billing_status = $4::public.tenant_billing_status
       where id = $5`,
      [input.name, input.slug, input.status, input.billingStatus, input.tenantId],
    );
  } else {
    const supabase = await createControlPlaneServerClient();
    const { error } = await supabase
      .from("tenants")
      .update({
        name: input.name,
        slug: input.slug,
        tenant_status: input.status,
        billing_status: input.billingStatus,
      })
      .eq("id", input.tenantId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/control");
  revalidatePath("/control/tenants");
  return { ok: true };
}

export async function deleteTenantAction(tenantId: string) {
  const session = await getSession("/control");
  if (!session || !session.canAccessControl) {
    throw new Error("Control-plane access is required.");
  }

  if (shouldUseLocalControlPlaneFallback()) {
    await queryControlPlaneLocalDb(`delete from public.tenants where id = $1`, [tenantId]);
  } else {
    const supabase = await createControlPlaneServerClient();
    const { error } = await supabase.from("tenants").delete().eq("id", tenantId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/control");
  revalidatePath("/control/tenants");
  return { ok: true };
}

export async function eraseTenantDataAction(tenantId: string) {
  const session = await getSession("/control");
  if (!session || !session.canAccessControl) {
    throw new Error("Control-plane access is required.");
  }

  const target = await resolveTenantViewTarget(tenantId);
  if (!target) {
    throw new Error("Tenant view target could not be resolved.");
  }

  const churchId = target.church.id;

  // 1. Attempt local database fallback deletes
  try {
    await queryTenantLocalDb("delete from public.donations where church_id = $1", [churchId]);
    await queryTenantLocalDb("delete from public.volunteer_shifts where church_id = $1", [churchId]);
    await queryTenantLocalDb("delete from public.service_plans where church_id = $1", [churchId]);
    await queryTenantLocalDb("delete from public.events where church_id = $1", [churchId]);
    await queryTenantLocalDb("delete from public.profiles where church_id = $1", [churchId]);

    const adminEmail = `admin@${target.church.slug}.org`;
    await queryTenantLocalDb(
      `insert into public.profiles (full_name, email, church_id, role, membership_status, directory_visible, contact_allowed)
       values ($1, $2, $3, 'church_admin', 'active', false, false)`,
      ["System Admin", adminEmail, churchId],
    );
  } catch (e) {
    console.warn("Local DB tenant data erasure failed (this is normal if using Supabase):", e);
  }

  // 2. Attempt Supabase service-role client deletes
  try {
    const supabase = createTenantAdminClient();
    await supabase.from("donations").delete().eq("church_id", churchId);
    await supabase.from("volunteer_shifts").delete().eq("church_id", churchId);
    await supabase.from("service_plans").delete().eq("church_id", churchId);
    await supabase.from("events").delete().eq("church_id", churchId);
    await supabase.from("profiles").delete().eq("church_id", churchId);

    const adminEmail = `admin@${target.church.slug}.org`;
    await supabase.from("profiles").insert({
      full_name: "System Admin",
      email: adminEmail,
      church_id: churchId,
      role: "church_admin",
      membership_status: "active",
      directory_visible: false,
      contact_allowed: false,
    });
  } catch (e) {
    console.warn("Supabase tenant data erasure failed (this is normal if using local fallbacks):", e);
  }

  revalidatePath("/control");
  revalidatePath("/control/tenants");
  return { ok: true };
}
