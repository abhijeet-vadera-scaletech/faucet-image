import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;

    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    const catalogDir = path.join(process.cwd(), "public/catalog-images");
    const filePath = path.join(catalogDir, filename);

    // Security check: ensure the file is within the catalog directory
    const resolvedPath = path.resolve(filePath);
    const resolvedCatalogDir = path.resolve(catalogDir);

    if (!resolvedPath.startsWith(resolvedCatalogDir)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const imageBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : "image/jpeg";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving catalog image:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 }
    );
  }
}
