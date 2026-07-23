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
}

// KDP 6x9 book layout in DXA (1440 = 1in)
const PAGE = {
  width: 8640, // 6"
  height: 12960, // 9"
  margin: { top: 1440, bottom: 1440, left: 1080, right: 720 }, // 1", 1", 0.75" gutter, 0.5" outside
};

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
                  size: { width: PAGE.width, height: PAGE.height, orientation: PageOrientation.PORTRAIT },
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