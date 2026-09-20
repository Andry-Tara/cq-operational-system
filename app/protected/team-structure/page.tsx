import {
  redirect,
} from "next/navigation";

import {
  getAccessContext,
} from "@/lib/admin/require-admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

import TeamStructureClient from "./team-structure-client";


function roleCodes(
  roles: any[]
) {
  return new Set(
    (
      roles ??
      []
    ).map(
      (
        role: any
      ) =>
        String(
          role?.code ||
          ""
        )
          .trim()
          .toUpperCase()
    )
  );
}


export default async function TeamStructurePage() {
  const context =
    await getAccessContext();


  if (
    !context.user ||
    !context.profile
      ?.organization_id
  ) {
    redirect(
      "/login"
    );
  }


  const codes =
    roleCodes(
      context.roles
    );


  const isOrgAdmin =
    codes.has(
      "ORG_ADMIN"
    );


  const canManage =
    isOrgAdmin ||
    context.permissionCodes.includes(
      "team_structure.manage"
    );


  if (!canManage) {
    redirect(
      "/protected"
    );
  }


  const activeOutlet =
    await getActiveOutlet();


  if (!activeOutlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  const admin:
    any =
    createAdminClient();


  let outlets:
    any[] =
    [];


  if (isOrgAdmin) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "outlets"
        )
        .select(`
          id,
          code,
          name
        `)
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "is_active",
          true
        )
        .neq(
          "code",
          "CNT"
        )
        .order(
          "name",
          {
            ascending:
              true,
          }
        );


    if (error) {
      throw error;
    }


    outlets =
      data ??
      [];

  } else {
    const supabase =
      await createClient();


    const {
      data:
        hasOutletAccess,
    } =
      await supabase.rpc(
        "has_outlet_access",
        {
          p_outlet_id:
            activeOutlet.id,
        }
      );


    if (
      hasOutletAccess !==
      true
    ) {
      redirect(
        "/protected"
      );
    }


    const {
      data:
        outlet,
      error,
    } =
      await admin
        .from(
          "outlets"
        )
        .select(`
          id,
          code,
          name
        `)
        .eq(
          "id",
          activeOutlet.id
        )
        .eq(
          "organization_id",
          context.profile
            .organization_id
        )
        .eq(
          "is_active",
          true
        )
        .neq(
          "code",
          "CNT"
        )
        .maybeSingle();


    if (
      error ||
      !outlet
    ) {
      redirect(
        "/protected"
      );
    }


    outlets = [
      outlet,
    ];
  }


  const initialOutletId =
    outlets.some(
      (
        item
      ) =>
        item.id ===
        activeOutlet.id
    )
      ? activeOutlet.id
      : outlets[0]
          ?.id ||
        "";


  return (
    <TeamStructureClient
      outlets={
        outlets
      }
      initialOutletId={
        initialOutletId
      }
      isOrgAdmin={
        isOrgAdmin
      }
    />
  );
}
