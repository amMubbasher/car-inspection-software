import { connectToDB } from "@/lib/db";
import { Vat } from "@/models/Vat";
import { NextResponse } from "next/server";
import {
  assertObjectId,
  audit,
  AuthError,
  requirePermission,
  routeError,
} from "@/lib/rbac/server";
import { updateVatSchema } from "@/lib/validations/vatSchema";
import { toSafeVat, toVatSnapshot } from "@/lib/vat";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const actor = await requirePermission("vat.manage");
    const { id } = await params;
    assertObjectId(id, "VAT record");

    const parsed = updateVatSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    await connectToDB();

    const vat = await Vat.findById(id);
    if (!vat) throw new AuthError(404, "VAT record not found");
    const before = { ...toVatSnapshot(vat), isActive: vat.isActive };

    const { isActive, ...fields } = parsed.data;
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) vat.set(key, value);
    }
    if (isActive === true && !vat.isActive) {
      // Only one record can be active.
      await Vat.updateMany({ _id: { $ne: vat._id }, isActive: true }, { isActive: false });
    }
    if (isActive !== undefined) vat.isActive = isActive;
    await vat.save();

    await audit(actor, {
      action: "vat.update",
      targetType: "vat",
      targetId: vat._id,
      before,
      after: { ...toVatSnapshot(vat), isActive: vat.isActive },
    });

    return NextResponse.json(toSafeVat(vat.toObject()));
  } catch (error) {
    return routeError(error, "Failed to update VAT record");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const actor = await requirePermission("vat.manage");
    const { id } = await params;
    assertObjectId(id, "VAT record");
    await connectToDB();

    // Jobs keep their own copy of the VAT, so deleting a record never changes old receipts.
    const vat = await Vat.findByIdAndDelete(id).lean();
    if (!vat) throw new AuthError(404, "VAT record not found");

    await audit(actor, {
      action: "vat.delete",
      targetType: "vat",
      targetId: vat._id,
      before: { ...toVatSnapshot(vat), isActive: vat.isActive },
    });

    return NextResponse.json({ message: "VAT record deleted" });
  } catch (error) {
    return routeError(error, "Failed to delete VAT record");
  }
}
