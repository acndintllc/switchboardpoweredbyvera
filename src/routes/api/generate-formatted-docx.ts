import { createFileRoute } from "@tanstack/react-router";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  LevelFormat,
  PageOrientation,
} from "docx";

interface Body {
  content: string;
  title?: string;
  author?: string;
  trimSize?: string; // e.g. "6x9", "5x8", "8.5x11"
}

// KDP trim sizes in DXA (1440 = 1in). Margins tuned per KDP recommendations:
// gutter (inside) grows with page count; we use safe defaults for typical books.
const IN = (n: number) => Math.round(n * 1440);
const TRIM_SIZES: Record<string, { w: number; h: number; margin: { top: number; bottom: number; left: number; right: number }; label: string }> = {
  "5x8":     { w: IN(5),    h: IN(8),     margin: { top: IN(0.75), bottom: IN(0.75), left: IN(0.75), right: IN(0.5) },  label: "5 x 8" },
  "5.25x8":  { w: IN(5.25), h: IN(8),     margin: { top: IN(0.75), bottom: IN(0.75), left: IN(0.75), right: IN(0.5) },  label: "5.25 x 8" },
  "5.5x8.5": { w: IN(5.5),  h: IN(8.5),   margin: { top: IN(0.75), bottom: IN(0.75), left: IN(0.75), right: IN(0.5) },  label: "5.5 x 8.5" },
  "6x9":     { w: IN(6),    h: IN(9),     margin: { top: IN(1),    bottom: IN(1),    left: IN(0.75), right: IN(0.5) },  label: "6 x 9" },
  "6.14x9.21": { w: IN(6.14), h: IN(9.21), margin: { top: IN(1),   bottom: IN(1),    left: IN(0.75), right: IN(0.5) },  label: "6.14 x 9.21" },
  "7x10":    { w: IN(7),    h: IN(10),    margin: { top: IN(1),    bottom: IN(1),    left: IN(0.75), right: IN(0.5) },  label: "7 x 10" },
  "7.5x9.25":{ w: IN(7.5),  h: IN(9.25),  margin: { top: IN(1),    bottom: IN(1),    left: IN(0.75), right: IN(0.5) },  label: "7.5 x 9.25" },
  "8x10":    { w: IN(8),    h: IN(10),    margin: { top: IN(1),    bottom: IN(1),    left: IN(0.75), right: IN(0.5) },  label: "8 x 10" },
  "8.5x11":  { w: IN(8.5),  h: IN(11),    margin: { top: IN(1),    bottom: IN(1),    left: IN(1),    right: IN(1) },    label: "8.5 x 11 (US Letter)" },
  "8.5x5.5": { w: IN(8.5),  h: IN(5.5),   margin: { top: IN(0.5),  bottom: IN(0.5),  left: IN(0.75), right: IN(0.5) },  label: "8.5 x 5.5 (Half Letter Landscape)" },
  "a4":      { w: IN(8.27), h: IN(11.69), margin: { top: IN(1),    bottom: IN(1),    left: IN(1),    right: IN(1) },    label: "A4" },
  "a5":      { w: IN(5.83), h: IN(8.27),  margin: { top: IN(0.75), bottom: IN(0.75), left: IN(0.75), right: IN(0.5) },  label: "A5" },
};
const DEFAULT_TRIM = "6x9";

function makeRun(text: string, opts: { bold?: boolean; italic?: boolean } = {}) {
  return new TextRun({ text, font: "Garamond", size: 24, ...opts });
}

function parseInline(text: string): TextRun[] {
  // Split on **bold** markers; keep segments
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return makeRun(p.slice(2, -2), { bold: true });
    }
    return makeRun(p);
  });
}

function buildChildren(content: string): Paragraph[] {
  const out: Paragraph[] = [];
  const lines = content.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Chapter detection: "Chapter 1" or "Chapter One"
    if (/^chapter\s+(\d+|[a-z]+)/i.test(line)) {
      out.push(
        new Paragraph({
          children: [new PageBreak(), makeRun(line, { bold: true })],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 720, after: 480 },
        }),
      );
      continue;
    }

    // ALL CAPS section header
    if (line.length > 3 && line.length < 100 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
      out.push(
        new Paragraph({
          children: [makeRun(line, { bold: true })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 240 },
        }),
      );
      continue;
    }

    // **Bold whole line** -> heading 2
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      out.push(
        new Paragraph({
          children: [makeRun(line.replace(/^\*\*|\*\*$/g, ""), { bold: true })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 240 },
        }),
      );
      continue;
    }

    // Bullet
    if (/^[-•]\s+/.test(line)) {
      out.push(
        new Paragraph({
          children: parseInline(line.replace(/^[-•]\s+/, "")),
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 120 },
        }),
      );
      continue;
    }

    // Numbered
    if (/^\d+\.\s+/.test(line)) {
      out.push(
        new Paragraph({
          children: parseInline(line.replace(/^\d+\.\s+/, "")),
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 120 },
        }),
      );
      continue;
    }

    if (line.startsWith(">")) {
      const text = line.replace(/^>\s?/, "");
      out.push(
        new Paragraph({
          children: [new TextRun({ text, font: "Garamond", size: 24, italics: true })],
          indent: { left: 720, right: 720 },
          spacing: { after: 160 },
        }),
      );
      continue;
    }

    out.push(
      new Paragraph({
        children: parseInline(line),
        alignment: AlignmentType.LEFT,
        spacing: { line: 276, after: 120 }, // 1.15 line spacing
      }),
    );
  }

  return out;
}

export const Route = createFileRoute("/api/generate-formatted-docx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const content = (body.content ?? "").toString();
        if (!content.trim()) {
          return new Response("Empty content", { status: 400 });
        }
        const title = (body.title ?? "Untitled Document").toString();
        const author = (body.author ?? "").toString();
        const trimKey = (body.trimSize ?? DEFAULT_TRIM).toString().toLowerCase();
        const PAGE = TRIM_SIZES[trimKey] ?? TRIM_SIZES[DEFAULT_TRIM];
        const isLandscape = PAGE.w > PAGE.h;

        const titleChildren: Paragraph[] = [
          new Paragraph({
            children: [new TextRun({ text: title, font: "Garamond", size: 48, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 2880, after: 480 },
          }),
        ];
        if (author) {
          titleChildren.push(
            new Paragraph({
              children: [new TextRun({ text: author, font: "Garamond", size: 28, italics: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 },
            }),
          );
        }
        titleChildren.push(new Paragraph({ children: [new PageBreak()] }));

        const doc = new Document({
          creator: author || "SWITCHBOARD Powered by VERA",
          title,
          styles: {
            default: {
              document: {
                run: { font: "Garamond", size: 24 },
                paragraph: { spacing: { line: 276, after: 120 } },
              },
            },
            paragraphStyles: [
              {
                id: "Heading1",
                name: "Heading 1",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: "Garamond", size: 36, bold: true, color: "000000" },
                paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 720, after: 480 }, outlineLevel: 0 },
              },
              {
                id: "Heading2",
                name: "Heading 2",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: "Garamond", size: 28, bold: true },
                paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 1 },
              },
            ],
          },
          numbering: {
            config: [
              {
                reference: "bullets",
                levels: [
                  {
                    level: 0,
                    format: LevelFormat.BULLET,
                    text: "\u2022",
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                  },
                ],
              },
              {
                reference: "numbers",
                levels: [
                  {
                    level: 0,
                    format: LevelFormat.DECIMAL,
                    text: "%1.",
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                  },
                ],
              },
            ],
          },
          sections: [
            {
              properties: {
                page: {
                  size: {
                    width: isLandscape ? PAGE.h : PAGE.w,
                    height: isLandscape ? PAGE.w : PAGE.h,
                    orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
                  },
                  margin: PAGE.margin,
                },
              },
              children: [...titleChildren, ...buildChildren(content)],
            },
          ],
        });

        const buf = await Packer.toBuffer(doc);
        const bytes = new Uint8Array(buf);
        const safeName = title.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "document";
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${safeName}.docx"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});