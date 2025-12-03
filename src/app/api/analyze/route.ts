import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MODEL_NAME = "gemini-2.0-flash-lite";

const SYSTEM_PROMPT = `You are an expert plumbing inventory assistant. 
You have access to a specific catalog of faucet images (provided in context) with filenames. 
Your job is to visually compare a user-provided photo against this catalog 
and identify the specific catalog items that match best. 
Prioritize the faucet silhouette and primary shape (spout arc, handle count, mounting style) 
before considering secondary cues like finish, hardware details, or branding. 
When shapes feel close, refine the comparison by highlighting smaller distinguishing traits 
so the user understands why each candidate was chosen. 
If you do not have any DIRECT matches, respond with the best matches in array and include a helpful message.
Always respond with JSON that follows this schema exactly:
{
  "message": "<optional text to the user>",
  "matches": [
    {
      "filename": "<catalog filename>",
      "title": "<title or empty string>",
      "brand": "<brand or empty string>",
      "color": "<color or empty string>",
      "confidence": <number between 0 and 1>,
      "reasoning": "<short explanation>"
    }
  ]
}
Return exactly three entries in the matches array (sorted by confidence, 
highest first) and only reference filenames that exist in the provided catalog. 
Do not output any explanation outside of this JSON. 
You can also ask questions to user to better filter your results.`;

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];

interface ImageMetadataEntry {
  Title?: string;
  Brand?: string;
  VarDim_Color?: string;
  VarDim_ColorCode?: string;
  [key: string]: unknown;
}

interface ImageMetadata {
  [filename: string]: ImageMetadataEntry;
}

interface FaucetMatch {
  filename: string;
  title?: string;
  brand?: string;
  color?: string;
  confidence: number;
  reasoning: string;
}

interface FaucetResponse {
  message?: string;
  matches: FaucetMatch[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  imageUrl?: string;
  matches?: FaucetMatch[];
  assistantMessage?: string;
}

// Cache for catalog context to avoid reloading on every request
let catalogContextCache: Part[] | null = null;
let imageMetadataCache: ImageMetadata | null = null;

function loadImageMetadata(): ImageMetadata {
  if (imageMetadataCache) {
    return imageMetadataCache;
  }

  const METADATA_FILE = path.join(process.cwd(), "public/image_metadata.json");

  if (!fs.existsSync(METADATA_FILE)) {
    console.warn("Metadata file not found:", METADATA_FILE);
    return {};
  }

  try {
    const rawData = fs.readFileSync(METADATA_FILE, "utf-8");
    const fullMetadata = JSON.parse(rawData) as ImageMetadata;

    // Extract only the fields we need (like the Python version)
    const metadata: ImageMetadata = {};
    for (const [key, entry] of Object.entries(fullMetadata)) {
      metadata[key] = {
        Title: entry.Title || "",
        Brand: entry.Brand || "",
        VarDim_Color: entry.VarDim_Color || "",
        VarDim_ColorCode: entry.VarDim_ColorCode || "",
      };
    }

    imageMetadataCache = metadata;
    return metadata;
  } catch (error) {
    console.error("Error loading metadata:", error);
    return {};
  }
}

function formatMetadata(metadata: ImageMetadataEntry | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "No additional metadata provided.";
  }
  return JSON.stringify(metadata);
}

function buildCatalogContext(): Part[] {
  if (catalogContextCache) {
    return catalogContextCache;
  }

  const CATALOG_DIR = path.join(process.cwd(), "public/catalog-images");

  if (!fs.existsSync(CATALOG_DIR)) {
    console.warn("Catalog directory not found:", CATALOG_DIR);
    return [];
  }

  const metadata = loadImageMetadata();
  const parts: Part[] = [];

  const files = fs.readdirSync(CATALOG_DIR).sort();

  for (const filename of files) {
    const ext = path.extname(filename).toLowerCase();
    if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
      continue;
    }

    const filePath = path.join(CATALOG_DIR, filename);
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      continue;
    }

    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    const metadataText = formatMetadata(metadata[filename]);

    // Add text part with filename and metadata
    parts.push({
      text: `Catalog Image: ${filename}\nMetadata: ${metadataText}`,
    });

    // Add image part
    parts.push({
      inlineData: {
        mimeType,
        data: base64Image,
      },
    });
  }

  console.log(`Loaded ${parts.length / 2} catalog images`);
  catalogContextCache = parts;
  return parts;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const message = formData.get("message") as string | null;
    const image = formData.get("image") as File | null;
    const historyJson = formData.get("history") as string | null;

    if (!message && !image) {
      return NextResponse.json(
        { error: "Please provide a message or an image" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Build the prompt parts
    const parts: Part[] = [];

    // 1. Add system prompt
    parts.push({ text: SYSTEM_PROMPT });

    // 2. Add catalog context (all catalog images with metadata)
    const catalogContext = buildCatalogContext();
    if (catalogContext.length === 0) {
      return NextResponse.json(
        { error: "No catalog images found. Please add images to the catalog." },
        { status: 500 }
      );
    }
    parts.push(...catalogContext);

    // 3. Add conversation history if available
    if (historyJson) {
      try {
        const history: ChatMessage[] = JSON.parse(historyJson);
        for (const msg of history) {
          if (msg.role === "user") {
            if (msg.text) {
              parts.push({ text: `User: ${msg.text}` });
            }
            if (msg.imageUrl) {
              parts.push({ text: "User uploaded an image of a faucet." });
            }
          } else if (msg.role === "assistant") {
            if (msg.assistantMessage) {
              parts.push({ text: `Assistant: ${msg.assistantMessage}` });
            }
            if (msg.matches && msg.matches.length > 0) {
              parts.push({
                text: `Assistant found matches: ${JSON.stringify(msg.matches)}`,
              });
            }
          }
        }
      } catch {
        // Ignore history parsing errors
      }
    }

    // 4. Add current user message
    if (message) {
      parts.push({ text: `User: ${message}` });
    } else if (image) {
      parts.push({
        text: "User: Find the best match for this faucet from the catalog.",
      });
    }

    // 5. Add user's uploaded image if provided
    if (image) {
      const imageBuffer = await image.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      const mimeType = image.type || "image/png";

      parts.push({
        inlineData: {
          mimeType,
          data: base64Image,
        },
      });
    }

    // Generate response
    const result = await model.generateContent(parts);
    const response = await result.response;
    let responseText = response.text();

    // Clean up the response (remove markdown code blocks)
    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.slice(7);
    }
    if (responseText.startsWith("```")) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith("```")) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    // Parse the JSON response
    let parsedResponse: FaucetResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse response:", responseText);
      return NextResponse.json(
        {
          error: "Failed to parse model response",
          rawResponse: responseText,
        },
        { status: 500 }
      );
    }

    // Validate the response structure
    if (!parsedResponse.matches || !Array.isArray(parsedResponse.matches)) {
      return NextResponse.json(
        {
          error: "Invalid response structure from model",
          rawResponse: responseText,
        },
        { status: 500 }
      );
    }

    // Load metadata for enriching response
    const metadata = loadImageMetadata();

    return NextResponse.json({
      message: parsedResponse.message || "",
      matches: parsedResponse.matches.map((match) => {
        const meta = metadata[match.filename] || {};
        return {
          filename: match.filename,
          title: match.title || meta.Title || "",
          brand: match.brand || meta.Brand || "",
          color: match.color || meta.VarDim_Color || "",
          confidence:
            typeof match.confidence === "number" ? match.confidence : 0,
          reasoning: match.reasoning || "",
        };
      }),
    });
  } catch (error) {
    console.error("Error in analyze API:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
