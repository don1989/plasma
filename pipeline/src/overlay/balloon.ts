/**
 * SVG speech balloon generator.
 *
 * Produces SVG buffers for speech, thought, and narration balloon
 * types, ready for compositing onto panel images via Sharp.
 */

import type { BalloonType } from '../types/overlay.js';

/**
 * Escape XML special characters in text content.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate an SVG speech balloon buffer.
 *
 * @param text - The dialogue text to display inside the balloon
 * @param width - Balloon width in pixels
 * @param height - Balloon body height in pixels (excludes tail)
 * @param type - Balloon visual type (speech, thought, narration)
 * @param font - Font family and size for the dialogue text
 * @param tail - Which side the speech tail points toward; 'none' draws no tail
 * @returns SVG content as a Buffer for Sharp composite input
 */
export function generateBalloonSvg(
  text: string,
  width: number,
  height: number,
  type: BalloonType,
  font: { family: string; size: number } = { family: 'sans-serif', size: 14 },
  tail: 'left' | 'right' | 'none' = 'left',
): Buffer {
  const escapedText = escapeXml(text);
  const hasTail = type === 'speech' && tail !== 'none';
  const tailHeight = hasTail ? 30 : 0;
  const totalHeight = height + tailHeight;
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2 - 3; // slight inset for stroke
  const ry = height / 2 - 3;

  let svgBody: string;

  switch (type) {
    case 'speech': {
      // White ellipse with solid black stroke and triangular tail.
      // Tail base sits at 30% of the width for a left tail, 70% for right.
      const tailCx = tail === 'right' ? width * 0.7 : width * 0.3;
      const tailX1 = tailCx - 10;
      const tailX2 = tailCx + 10;
      const tailTipX = tailCx + 5;
      const tailTipY = height + tailHeight;
      const tailPolygon = hasTail
        ? `
        <polygon points="${tailX1},${height - 5} ${tailX2},${height - 5} ${tailTipX},${tailTipY}"
          fill="white" stroke="black" stroke-width="2.5" />`
        : '';
      svgBody = `
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
          fill="white" stroke="black" stroke-width="2.5" />${tailPolygon}
        <!-- Cover the stroke overlap between tail and ellipse -->
        <ellipse cx="${cx}" cy="${cy}" rx="${rx - 1}" ry="${ry - 1}"
          fill="white" stroke="none" />`;
      break;
    }

    case 'thought': {
      // White ellipse with dashed stroke, no tail
      svgBody = `
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
          fill="white" stroke="black" stroke-width="2"
          stroke-dasharray="8,4" />`;
      break;
    }

    case 'narration': {
      // Beige rectangle with rounded corners
      svgBody = `
        <rect x="2" y="2" width="${width - 4}" height="${height - 4}"
          rx="4" ry="4"
          fill="#f5f5dc" stroke="black" stroke-width="2" />`;
      break;
    }
  }

  // Word-wrap long text by splitting into multiple <tspan> lines
  const words = escapedText.split(' ');
  const maxCharsPerLine = Math.max(Math.floor(width / 8), 10);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Build tspan elements for each line
  const lineHeight = 18;
  const textStartY = cy - ((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${cx}" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`,
    )
    .join('\n        ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
    ${svgBody}
    <text x="${cx}" y="${textStartY}" text-anchor="middle" dominant-baseline="middle"
      font-family="${escapeXml(font.family)}" font-size="${font.size}" fill="black">
      ${tspans}
    </text>
  </svg>`;

  return Buffer.from(svg);
}
