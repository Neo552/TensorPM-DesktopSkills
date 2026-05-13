import PptxGenJS from "@tensorpm/pptx";

import { actionItems, context, decisions, project } from "@tensorpm/sdk";

interface Inputs {
  audience?: string;
  maxItems?: number;
}

const inputs = context.inputs as Inputs;
const audience = typeof inputs.audience === "string" && inputs.audience.trim().length > 0
  ? inputs.audience.trim()
  : null;
const maxItems = clampInt(inputs.maxItems ?? 5, 1, 10);

const proj = project.get();
const projectName = proj?.name ?? "Project";
const goal = proj?.goal ?? proj?.description ?? "";
const health = proj?.health ?? null;

const allItems = actionItems.list();
const openItems = allItems.filter((i) => i.status === "open");
const inProgress = allItems.filter((i) => i.status === "inProgress" || i.status === "in_progress");
const completed = allItems.filter((i) => i.status === "completed");

const activeDecisions = decisions.list().filter((d) => d.status === "active");

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.title = `${projectName} — Status`;

// ── Slide 1: title ───────────────────────────────────────────────────
const title = pres.addSlide();
title.background = { color: "F8FAFC" };
title.addText(projectName, {
  x: 0.5,
  y: 1.6,
  w: 12,
  h: 1.6,
  fontSize: 48,
  bold: true,
  color: "0F172A",
  fontFace: "Calibri",
});
if (goal) {
  title.addText(goal, {
    x: 0.5,
    y: 3.2,
    w: 12,
    h: 1.4,
    fontSize: 22,
    italic: true,
    color: "475569",
    fontFace: "Calibri",
  });
}
const titleFooter: string[] = [];
if (audience) titleFooter.push(`For: ${audience}`);
titleFooter.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
if (health) titleFooter.push(`Health: ${health}`);
title.addText(titleFooter.join("   ·   "), {
  x: 0.5,
  y: 6.2,
  w: 12,
  h: 0.5,
  fontSize: 14,
  color: "94A3B8",
  fontFace: "Calibri",
});

// ── Slide 2: status snapshot ─────────────────────────────────────────
const status = pres.addSlide();
status.background = { color: "FFFFFF" };
status.addText("Status snapshot", {
  x: 0.5,
  y: 0.4,
  w: 12,
  h: 0.9,
  fontSize: 32,
  bold: true,
  color: "0F172A",
  fontFace: "Calibri",
});
const statusBullets = [
  { text: `Open items: ${openItems.length}`, options: { bullet: true, fontSize: 22, color: "1E293B" } },
  { text: `In progress: ${inProgress.length}`, options: { bullet: true, fontSize: 22, color: "1E293B" } },
  { text: `Completed: ${completed.length}`, options: { bullet: true, fontSize: 22, color: "1E293B" } },
  { text: `Active decisions: ${activeDecisions.length}`, options: { bullet: true, fontSize: 22, color: "1E293B" } },
];
status.addText(statusBullets, {
  x: 0.7,
  y: 1.6,
  w: 12,
  h: 4.5,
  valign: "top",
  fontFace: "Calibri",
});

// ── Slide 3: next up ─────────────────────────────────────────────────
const next = pres.addSlide();
next.background = { color: "FFFFFF" };
next.addText(`Next up — top ${Math.min(maxItems, openItems.length || maxItems)} open items`, {
  x: 0.5,
  y: 0.4,
  w: 12,
  h: 0.9,
  fontSize: 32,
  bold: true,
  color: "0F172A",
  fontFace: "Calibri",
});
const topOpen = [...openItems]
  .sort((a, b) => {
    const aP = a.priority ?? Number.POSITIVE_INFINITY;
    const bP = b.priority ?? Number.POSITIVE_INFINITY;
    if (aP !== bP) return aP - bP;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  })
  .slice(0, maxItems);
if (topOpen.length === 0) {
  next.addText("No open items.", {
    x: 0.7,
    y: 1.6,
    w: 12,
    h: 4.5,
    fontSize: 22,
    italic: true,
    color: "94A3B8",
    fontFace: "Calibri",
  });
} else {
  next.addText(
    topOpen.map((item) => {
      const due = item.dueDate ? `  ·  due ${item.dueDate.slice(0, 10)}` : "";
      return {
        text: `${item.text}${due}`,
        options: { bullet: true, fontSize: 20, color: "1E293B" },
      };
    }),
    {
      x: 0.7,
      y: 1.6,
      w: 12,
      h: 5.0,
      valign: "top",
      fontFace: "Calibri",
    },
  );
}

const buf = await pres.write({ outputType: "uint8array" });
const slug = `project-${projectName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 40) || "deck"}`;
const filename = `${slug}.pptx`;
const outPath = Deno.env.get("TPM_RUN_DIR") + "/out/" + filename;
Deno.writeFileSync(outPath, buf as Uint8Array);

// Imported but never read otherwise — keep so the SDK loads correctly under
// strict TS. (`context` is the read-trigger for the lazy snapshot init.)
void context;

console.log(`pptx ok: ${filename} (${(buf as Uint8Array).byteLength} bytes)`);

import { output } from "@tensorpm/sdk";
output({ artifact: filename, slideCount: 3 });

function clampInt(n: unknown, min: number, max: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : min;
  return Math.min(max, Math.max(min, v));
}
