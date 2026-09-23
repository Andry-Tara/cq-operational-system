import { NextResponse } from "next/server";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(
        request.url
      );

    const workflowId =
      String(
        url.searchParams.get(
          "workflowId"
        ) ||
        ""
      ).trim();

    if (
      !UUID.test(
        workflowId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid workflow evidence request.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const admin =
      createAdminClient();

    const {
      data:
        profile,
      error:
        profileError,
    } =
      await admin
        .from(
          "profiles"
        )
        .select(`
          id,
          organization_id,
          is_active
        `)
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

    if (
      profileError
    ) {
      throw profileError;
    }

    if (
      !profile ||
      !profile.organization_id ||
      profile.is_active === false
    ) {
      return NextResponse.json(
        {
          error:
            "Access denied.",
        },
        {
          status: 403,
        }
      );
    }

    const managementAccess =
      await checkPermissionApi(
        "exceptions.manage"
      );

    const canManage =
      managementAccess.ok;

    const {
      data:
        workflow,
      error:
        workflowError,
    } =
      await admin
        .from(
          "exception_workflows"
        )
        .select(`
          id,
          organization_id,
          outlet_id,
          assigned_to
        `)
        .eq(
          "id",
          workflowId
        )
        .eq(
          "organization_id",
          profile.organization_id
        )
        .maybeSingle();

    if (
      workflowError
    ) {
      throw workflowError;
    }

    if (!workflow) {
      return NextResponse.json(
        {
          error:
            "Workflow not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!canManage) {
      if (
        workflow.assigned_to !==
        user.id
      ) {
        return NextResponse.json(
          {
            error:
              "This exception is not assigned to you.",
          },
          {
            status: 403,
          }
        );
      }

      const {
        data:
          outletAccess,
        error:
          outletAccessError,
      } =
        await admin
          .from(
            "user_outlets"
          )
          .select(
            "outlet_id"
          )
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "outlet_id",
            workflow.outlet_id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();

      if (
        outletAccessError
      ) {
        throw outletAccessError;
      }

      if (!outletAccess) {
        return NextResponse.json(
          {
            error:
              "Your outlet access is no longer active.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const {
      data:
        rows,
      error:
        rowsError,
    } =
      await admin
        .from(
          "exception_workflow_evidence"
        )
        .select(`
          id,
          storage_bucket,
          storage_path,
          original_filename,
          mime_type,
          file_size,
          note,
          uploaded_at,
          uploaded_by
        `)
        .eq(
          "workflow_id",
          workflowId
        )
        .eq(
          "organization_id",
          profile.organization_id
        )
        .order(
          "uploaded_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          20
        );

    if (
      rowsError
    ) {
      throw rowsError;
    }

    const evidence =
      await Promise.all(
        (
          rows ??
          []
        ).map(
          async (
            row: any
          ) => {
            let signedUrl =
              "";

            if (
              row.storage_bucket &&
              row.storage_path
            ) {
              const {
                data:
                  signed,
              } =
                await admin
                  .storage
                  .from(
                    row.storage_bucket
                  )
                  .createSignedUrl(
                    row.storage_path,
                    60 * 60
                  );

              signedUrl =
                signed
                  ?.signedUrl ||
                "";
            }

            return {
              id:
                String(
                  row.id
                ),
              originalFilename:
                row.original_filename,
              mimeType:
                row.mime_type,
              fileSize:
                row.file_size,
              note:
                row.note,
              uploadedAt:
                row.uploaded_at,
              signedUrl,
            };
          }
        )
      );

    return NextResponse.json({
      evidence,
    });
  } catch (
    error: any
  ) {
    console.error(
      "Exception evidence error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load exception evidence.",
      },
      {
        status: 500,
      }
    );
  }
}
