import type PptxGenJS from "pptxgenjs";
import type { DiagramNode, Slide } from "./deck";

type PptxSlide = ReturnType<InstanceType<typeof PptxGenJS>["addSlide"]>;

const PAPER = "FFFEFB";
const INK = "0E1B2A";
const INK_SOFT = "3C4A5A";
const CLINICAL = "0D7A6F";
const CLINICAL_DEEP = "085A52";
const RULE = "E2DED4";

/**
 * Diagrams are drawn as native PowerPoint shapes rather than a flattened
 * picture, so the deck stays editable after download — a doctor can retype a
 * box or recolour it. Geometry mirrors `Diagram.tsx`.
 */
export function renderDiagram(
  s: PptxSlide,
  slide: Slide,
  dark: boolean,
  bounds: { x: number; y: number; w: number; h: number },
) {
  const nodes = slide.nodes ?? [];
  if (nodes.length === 0) return;

  switch (slide.layout) {
    case "mecanismo":
      return mechanism(s, slide, nodes, dark, bounds);
    case "fluxo":
      return flow(s, nodes, dark, bounds);
    default:
      return cards(s, nodes, dark, bounds);
  }
}

function colors(dark: boolean) {
  return {
    boxFill: dark ? "16232F" : PAPER,
    boxLine: dark ? "35485A" : RULE,
    heading: dark ? PAPER : CLINICAL_DEEP,
    body: dark ? "C7D0D9" : INK_SOFT,
    accent: dark ? PAPER : CLINICAL,
    onAccent: dark ? INK : PAPER,
    connector: dark ? "6D7F90" : CLINICAL,
  };
}

function nodeBox(
  s: PptxSlide,
  node: DiagramNode,
  dark: boolean,
  box: { x: number; y: number; w: number; h: number },
) {
  const c = colors(dark);
  s.addShape("roundRect", {
    ...box,
    fill: { color: c.boxFill },
    line: { color: c.boxLine, width: 1 },
    rectRadius: 0.06,
  });

  const lines: Array<{ text: string; options: Record<string, unknown> }> = [
    {
      text: node.heading,
      options: {
        fontSize: 12,
        bold: true,
        color: c.heading,
        breakLine: true,
      },
    },
  ];
  if (node.body) {
    lines.push({
      text: node.body,
      options: { fontSize: 10, color: c.body, breakLine: false },
    });
  }

  s.addText(lines, {
    x: box.x + 0.14,
    y: box.y + 0.1,
    w: box.w - 0.28,
    h: box.h - 0.2,
    valign: "top",
    lineSpacingMultiple: 1.1,
  });
}

function mechanism(
  s: PptxSlide,
  slide: Slide,
  nodes: DiagramNode[],
  dark: boolean,
  b: { x: number; y: number; w: number; h: number },
) {
  const c = colors(dark);
  const branches = nodes.slice(0, 4);
  const hubW = slide.hub ? b.w * 0.26 : 0;
  const gap = 0.22;
  const rightX = b.x + hubW + (slide.hub ? gap * 2 : 0);
  const rightW = b.x + b.w - rightX;

  if (slide.hub) {
    const hubH = Math.min(b.h * 0.5, 1.5);
    s.addShape("roundRect", {
      x: b.x,
      y: b.y + (b.h - hubH) / 2,
      w: hubW,
      h: hubH,
      fill: { color: dark ? "16323C" : "E7F2F0" },
      line: { color: c.accent, width: 2 },
      rectRadius: 0.08,
    });
    s.addText(slide.hub, {
      x: b.x + 0.12,
      y: b.y + (b.h - hubH) / 2,
      w: hubW - 0.24,
      h: hubH,
      align: "center",
      valign: "middle",
      fontSize: 13,
      bold: true,
      color: c.heading,
    });
    // Hub → branches.
    s.addShape("line", {
      x: b.x + hubW,
      y: b.y + b.h / 2,
      w: gap * 2,
      h: 0,
      line: { color: c.connector, width: 1.75, endArrowType: "triangle" },
    });
  }

  const outcomeH = slide.outcome ? 0.62 : 0;
  const gridH = b.h - outcomeH - (slide.outcome ? 0.36 : 0);
  // Three branches in two columns leave a hole; stack them instead.
  const columns = branches.length >= 4 ? 2 : 1;
  const cellW = (rightW - gap * (columns - 1)) / columns;
  const rows = Math.ceil(branches.length / columns);
  const cellH = (gridH - gap * (rows - 1)) / rows;

  branches.forEach((node, i) => {
    nodeBox(s, node, dark, {
      x: rightX + (i % columns) * (cellW + gap),
      y: b.y + Math.floor(i / columns) * (cellH + gap),
      w: cellW,
      h: cellH,
    });
  });

  if (slide.outcome) {
    const y = b.y + gridH + 0.36;
    s.addShape("line", {
      x: rightX + rightW / 2,
      y: b.y + gridH,
      w: 0,
      h: 0.3,
      line: { color: c.connector, width: 1.75, endArrowType: "triangle" },
    });
    s.addShape("roundRect", {
      x: rightX,
      y,
      w: rightW,
      h: outcomeH,
      fill: { color: c.accent },
      line: { type: "none" },
      rectRadius: 0.06,
    });
    s.addText(slide.outcome.toUpperCase(), {
      x: rightX,
      y,
      w: rightW,
      h: outcomeH,
      align: "center",
      valign: "middle",
      fontSize: 12,
      bold: true,
      charSpacing: 1,
      color: c.onAccent,
    });
  }
}

function flow(
  s: PptxSlide,
  nodes: DiagramNode[],
  dark: boolean,
  b: { x: number; y: number; w: number; h: number },
) {
  const c = colors(dark);
  const steps = nodes.slice(0, 5);
  const connector = 0.34;
  const cellW = (b.w - connector * (steps.length - 1)) / steps.length;
  const chip = 0.42;
  const boxH = Math.min(b.h - chip - 0.2, 1.9);
  const top = b.y + (b.h - (chip + 0.2 + boxH)) / 2;

  steps.forEach((node, i) => {
    const x = b.x + i * (cellW + connector);

    s.addShape("ellipse", {
      x,
      y: top,
      w: chip,
      h: chip,
      fill: { color: c.accent },
      line: { type: "none" },
    });
    s.addText(String(i + 1), {
      x,
      y: top,
      w: chip,
      h: chip,
      align: "center",
      valign: "middle",
      fontSize: 11,
      bold: true,
      color: c.onAccent,
    });

    nodeBox(s, node, dark, {
      x,
      y: top + chip + 0.2,
      w: cellW,
      h: boxH,
    });

    if (i < steps.length - 1) {
      s.addShape("line", {
        x: x + cellW + 0.05,
        y: top + chip + 0.2 + boxH / 2,
        w: connector - 0.1,
        h: 0,
        line: { color: c.connector, width: 1.75, endArrowType: "triangle" },
      });
    }
  });
}

function cards(
  s: PptxSlide,
  nodes: DiagramNode[],
  dark: boolean,
  b: { x: number; y: number; w: number; h: number },
) {
  const items = nodes.slice(0, 6);
  const columns = items.length <= 4 ? 2 : 3;
  const rows = Math.ceil(items.length / columns);
  const gap = 0.24;
  const cellW = (b.w - gap * (columns - 1)) / columns;
  const cellH = Math.min((b.h - gap * (rows - 1)) / rows, 1.5);
  const top = b.y + (b.h - (cellH * rows + gap * (rows - 1))) / 2;

  items.forEach((node, i) => {
    nodeBox(s, node, dark, {
      x: b.x + (i % columns) * (cellW + gap),
      y: top + Math.floor(i / columns) * (cellH + gap),
      w: cellW,
      h: cellH,
    });
  });
}
