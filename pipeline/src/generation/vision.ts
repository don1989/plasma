/**
 * Vision helpers: face detection via Gemini so balloons never cover a face.
 * Returns boxes normalised to the image (0-1). Failures return [] so lettering
 * degrades to the geometric heuristic instead of aborting.
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';

export interface NormRect { x: number; y: number; w: number; h: number }
export interface FaceDetection { faces: NormRect[]; imageSize: { w: number; h: number } }

const VISION_MODEL = process.env['GEMINI_VISION_MODEL'] ?? 'gemini-2.5-flash';

const PROMPT =
  'Find every human or humanoid character face in this comic panel, including partial or turned-away heads. ' +
  'Return JSON only: {"faces":[{"ymin":0-1000,"xmin":0-1000,"ymax":0-1000,"xmax":0-1000}]} with coordinates on a 0-1000 grid. ' +
  'Include the hair and headwear in each box. Return {"faces":[]} if there are none.';

export async function detectFaces(imagePath: string, apiKey: string): Promise<FaceDetection> {
  const buffer = await readFile(imagePath);
  const meta = await sharp(buffer).metadata();
  const imageSize = { w: meta.width ?? 1, h: meta.height ?? 1 };
  const ai = new GoogleGenAI({ apiKey });
  const mimeType = meta.format === 'jpeg' ? 'image/jpeg' : meta.format === 'webp' ? 'image/webp' : 'image/png';
  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: [{ role: 'user', parts: [{ inlineData: { data: buffer.toString('base64'), mimeType } }, { text: PROMPT }] }],
    config: { responseMimeType: 'application/json' },
  });
  const text = response.text ?? '';
  const faces = parseFaces(text);
  return { faces, imageSize };
}

/** Parse Gemini's 0-1000 grid boxes into normalised rects; tolerant of junk. */
export function parseFaces(text: string): NormRect[] {
  try {
    const start = text.indexOf('{');
    const json = JSON.parse(start >= 0 ? text.slice(start) : text) as { faces?: Array<Record<string, number>> };
    const out: NormRect[] = [];
    for (const f of json.faces ?? []) {
      const ymin = f['ymin'], xmin = f['xmin'], ymax = f['ymax'], xmax = f['xmax'];
      if ([ymin, xmin, ymax, xmax].some((v) => typeof v !== 'number')) continue;
      const x = Math.max(0, Math.min(1, xmin! / 1000)), y = Math.max(0, Math.min(1, ymin! / 1000));
      const w = Math.max(0, Math.min(1, xmax! / 1000) - x), h = Math.max(0, Math.min(1, ymax! / 1000) - y);
      const r4 = (n: number) => Math.round(n * 10000) / 10000;
      if (w > 0.01 && h > 0.01) out.push({ x: r4(x), y: r4(y), w: r4(w), h: r4(h) });
    }
    return out;
  } catch {
    return [];
  }
}
