import {
  NextRequest,
  NextResponse,
} from "next/server";

import { authErrorResponse, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";

function normalizePolicyNumber(
  value: string,
) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export async function GET(
  request: NextRequest,
) {
  try {
    const employee = await requireEmployee(request);

    const policyNumber =
      request.nextUrl.searchParams.get(
        "policyNumber",
      );

    if (!policyNumber?.trim()) {
      return NextResponse.json(
        {
          error:
            "Липсва номер на полица.",
        },
        {
          status: 400,
        },
      );
    }

    const normalized =
      normalizePolicyNumber(
        policyNumber,
      );

    const snapshot = await db
      .collection("policies")
      .where("locationId", "==", employee.locationId)
      .where(
        "policyNumberNormalized",
        "==",
        normalized,
      )
      .limit(1)
      .get();

    return NextResponse.json({
      exists: !snapshot.empty,
    });
  } catch (error) {
    console.error(
      "Check policy number error:",
      error,
    );

    return authErrorResponse(error) ?? NextResponse.json(
      {
        error:
          "Неуспешна проверка на номера на полицата.",
      },
      {
        status: 500,
      },
    );
  }
}
