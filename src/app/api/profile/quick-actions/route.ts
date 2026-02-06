import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseStoredQuickActions,
  type QuickActionItem,
} from "@/lib/quick-actions";

/** Liefert die gespeicherte Quick-Actions-Liste (für Bearbeitung). */
export async function GET() {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { quickActionsJson: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User nicht gefunden" }, { status: 404 });
  }

  const list = parseStoredQuickActions(user.quickActionsJson);
  return NextResponse.json({ ok: true, items: list });
}

/** Speichert die Quick-Actions-Liste des aktuellen Users. */
export async function PATCH(request: Request) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: { items?: QuickActionItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Request-Body" },
      { status: 400 }
    );
  }

  const items = body.items;
  if (!Array.isArray(items)) {
    return NextResponse.json(
      { ok: false, error: "items muss ein Array sein" },
      { status: 400 }
    );
  }

  const sanitized: QuickActionItem[] = items.slice(0, 20).map((a) => ({
    href: typeof a.href === "string" ? a.href.trim() : "",
    title: typeof a.title === "string" ? a.title.trim() : "",
    desc: typeof a.desc === "string" ? a.desc.trim() : "",
    icon: typeof a.icon === "string" && a.icon.length <= 8 ? a.icon : "🔗",
    accent: typeof a.accent === "string" ? a.accent : "",
  }));

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { quickActionsJson: JSON.stringify(sanitized) },
  });

  return NextResponse.json({ ok: true });
}
