import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    formVersionId: string;
  }>;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: RouteContext
) {
  const access = await checkPermissionApi(
    "forms.manage"
  );

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { formVersionId } = await context.params;

  if (!uuidPattern.test(formVersionId)) {
    return NextResponse.json(
      { error: "Invalid source version ID." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: newFormVersionId, error } =
      await supabase.rpc(
        "clone_form_version_to_draft",
        {
          p_source_form_version_id:
            formVersionId,
        }
      );

    if (error) {
      if (error.code === "28000") {
        return NextResponse.json(
          { error: "Unauthorized." },
          { status: 401 }
        );
      }

      if (error.code === "42501") {
        return NextResponse.json(
          {
            error:
              "You are not authorized to create a draft.",
          },
          { status: 403 }
        );
      }

      if (error.code === "22P02") {
        return NextResponse.json(
          { error: "Invalid source version ID." },
          { status: 400 }
        );
      }

      if (
        error.code === "22023" ||
        error.code === "PGRST116"
      ) {
        return NextResponse.json(
          {
            error:
              "The source version could not be found.",
          },
          { status: 404 }
        );
      }

      if (error.code === "55000") {
        return NextResponse.json(
          {
            error:
              "Only a published version can be cloned.",
          },
          { status: 409 }
        );
      }

      console.error(
        "Clone form version RPC failed:",
        error
      );
      return NextResponse.json(
        { error: "Unable to create draft." },
        { status: 500 }
      );
    }

    if (
      typeof newFormVersionId !== "string" ||
      !uuidPattern.test(newFormVersionId)
    ) {
      console.error(
        "Clone form version RPC returned an invalid form version ID."
      );
      return NextResponse.json(
        { error: "Unable to create draft." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      formVersionId: newFormVersionId,
    });
  } catch (error) {
    console.error(
      "Clone form version request failed:",
      error
    );
    return NextResponse.json(
      { error: "Unable to create draft." },
      { status: 500 }
    );
  }
}
