import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const record = await prisma.digestViewToken.findUnique({
    where: { token },
  });

  if (!record || record.expiresAt < new Date()) {
    return new Response(
      `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Abgelaufen</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h1>Link abgelaufen</h1><p>Dieser Link ist nicht mehr gültig oder abgelaufen.</p></body></html>`,
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  return new Response(record.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
