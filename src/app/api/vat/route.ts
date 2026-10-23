import { connectToDB } from "@/lib/db";
import { Vat } from "@/models/Vat";
import { NextResponse } from "next/server";
import { audit, requirePermission, routeError } from "@/lib/rbac/server";
import { createVatSchema } from "@/lib/validations/vatSchema";
import { toSafeVat } from "@/lib/vat";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("vat.view");
    await connectToDB();
    const vats = await Vat.find().sort({ isActive: -1, createdAt: -1 }).lean();
    return NextResponse.json(
      { vats: vats.map(toSafeVat) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return routeError(error, "Failed to fetch VAT records");
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("vat.manage");
    const parsed = createVatSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    await connectToDB();

    const data = parsed.data;
    if (data.isActive) await Vat.updateMany({ isActive: true }, { isActive: false });
    const vat = await Vat.create(data);

    await audit(actor, {
      action: "vat.create",
      targetType: "vat",
      targetId: vat._id,
      after: data,
    });

    return NextResponse.json(toSafeVat(vat.toObject()), { status: 201 });
  } catch (error) {
    return routeError(error, "Failed to create VAT record");
  }
}
