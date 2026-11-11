import { NextRequest, NextResponse } from "next/server";
import {
  authErrorResponse,
  requireAccessibleDocument,
  requireEmployee,
} from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { getOneYearEndDate } from "@/lib/time";

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Boolean(getOneYearEndDate(value));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const employee = await requireEmployee(request);
    const { id } = await params;
    const vehicle = await requireAccessibleDocument("vehicles", id, employee);

    return Response.json({ vehicle: { id: vehicle.id, ...vehicle.data() } });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      Response.json(
        { error: "Грешка при зареждане на автомобила." },
        { status: 500 },
      )
    );
  }
}

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const employee = await requireEmployee(req);

    const { id } = await params;
    const vehicle = await requireAccessibleDocument("vehicles", id, employee);
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Невалидни данни за автомобила." },
        { status: 400 },
      );
    }

    const update: Record<string, string> = {};

    if ("gtpStartDate" in body) {
      if (
        typeof body.gtpStartDate !== "string" ||
        !isValidIsoDate(body.gtpStartDate)
      ) {
        return NextResponse.json(
          {
            error: "Невалидна начална дата за ГТП.",
          },
          { status: 400 },
        );
      }

      update.gtpStartDate =
        body.gtpStartDate;
    }

    if ("gtpEndDate" in body) {
      if (
        typeof body.gtpEndDate !== "string" ||
        !isValidIsoDate(body.gtpEndDate)
      ) {
        return NextResponse.json(
          {
            error: "Невалидна крайна дата за ГТП.",
          },
          { status: 400 },
        );
      }

      update.gtpEndDate =
        body.gtpEndDate;
    }

    if ("vignetteStartDate" in body) {
      if (
        typeof body.vignetteStartDate !== "string" ||
        !isValidIsoDate(body.vignetteStartDate)
      ) {
        return NextResponse.json(
          {
            error:
              "Невалидна начална дата за винетка.",
          },
          { status: 400 },
        );
      }

      update.vignetteStartDate =
        body.vignetteStartDate;
    }

    if ("vignetteEndDate" in body) {
      if (
        typeof body.vignetteEndDate !== "string" ||
        !isValidIsoDate(body.vignetteEndDate)
      ) {
        return NextResponse.json(
          {
            error:
              "Невалидна крайна дата за винетка.",
          },
          { status: 400 },
        );
      }

      update.vignetteEndDate =
        body.vignetteEndDate;
    }

    if (
      "registrationCertificateNumber" in body
    ) {
      if (
        typeof body.registrationCertificateNumber !==
          "string" ||
        body.registrationCertificateNumber.trim().length > 100
      ) {
        return NextResponse.json(
          {
            error: "Невалиден номер на СРМПС.",
          },
          { status: 400 },
        );
      }

      update.registrationCertificateNumber =
        body.registrationCertificateNumber.trim();
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        {
          error: "Няма данни за промяна.",
        },
        { status: 400 },
      );
    }

    const current = vehicle.data()!;
    const gtpStartDate = update.gtpStartDate ?? current.gtpStartDate;
    const gtpEndDate = update.gtpEndDate ?? current.gtpEndDate;
    if (
      (update.gtpStartDate || update.gtpEndDate) &&
      typeof gtpStartDate === "string" &&
      typeof gtpEndDate === "string" &&
      gtpStartDate > gtpEndDate
    ) {
      return NextResponse.json(
        {
          error:
            "Началната дата на ГТП е след крайната.",
        },
        { status: 400 },
      );
    }

    const vignetteStartDate =
      update.vignetteStartDate ?? current.vignetteStartDate;
    const vignetteEndDate = update.vignetteEndDate ?? current.vignetteEndDate;
    if (
      (update.vignetteStartDate || update.vignetteEndDate) &&
      typeof vignetteStartDate === "string" &&
      typeof vignetteEndDate === "string" &&
      vignetteStartDate > vignetteEndDate
    ) {
      return NextResponse.json(
        {
          error:
            "Началната дата на винетката е след крайната.",
        },
        { status: 400 },
      );
    }

    await db
      .collection("vehicles")
      .doc(id)
      .update({
        ...update,
        updatedAt: new Date().toISOString(),
        updatedBy: employee.uid,
      });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Невалидни данни за автомобила.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Грешка при обновяване на автомобила.",
      },
      { status: 500 },
    );
  }
}
