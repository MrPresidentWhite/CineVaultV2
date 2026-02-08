import { NextResponse } from "next/server";
import { extname } from "node:path";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveUserBanner, toPublicUrl } from "@/lib/storage";
import { getAccentFromImage } from "@/lib/accent";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400 });
  }

  const file = formData.get("banner");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Keine Datei ausgewählt (Feld: banner)" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { ok: false, error: "Datei zu groß (max. 5 MB)" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Ungültiges Format (nur JPEG, PNG, WebP, GIF, AVIF)" },
      { status: 400 }
    );
  }

  const ext = extname(file.name || ".jpg").slice(1).toLowerCase() || "jpg";
  if (ext === "svg") {
    return NextResponse.json(
      { ok: false, error: "SVG/XML-Formate sind nicht erlaubt" },
      { status: 400 }
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const key = await saveUserBanner({
      userId: auth.user.id,
      data: buffer,
      ext,
      contentType: file.type,
    });

    const publicUrl = toPublicUrl(key);
    const profileBannerColor = await getAccentFromImage(publicUrl);

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { profileBannerKey: key, profileBannerColor },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[profile/banner]", err);
    return NextResponse.json(
      { ok: false, error: "Upload fehlgeschlagen" },
      { status: 500 }
    );
  }
}
