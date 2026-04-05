"use client";

import { useEffect, useRef } from "react";
import type { Agent, AgentStatus } from "@/lib/types/index";
import type { HealthResult } from "@/lib/agent-health";

interface Props {
  agents: Agent[];
  healthMap?: Record<string, HealthResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION — change these values to tweak layout and behaviour
// ─────────────────────────────────────────────────────────────────────────────

/** ms to walk to a desk when status → working (lower = faster) */
const WALK_SPEED       = 1800;
/** ms per wander step when idle */
const WANDER_SPEED     = 2400;
/** ms pause between wander steps */
const WANDER_PAUSE     = 1300;
/** auto-reset working → idle if no update arrives */
const WORKING_TIMEOUT  = 3 * 60 * 1000;
/** auto-reset replying → idle if no task_completed arrives */
const REPLYING_TIMEOUT = 15 * 1000;

// WHERE TO CHANGE THINGS:
//  • Number of desks      → DESK_LAYOUT array inside create()
//  • Number of agents     → agents[] in src/app/room/page.tsx
//  • Walk / wander speed  → WALK_SPEED / WANDER_SPEED above
//  • Wander zone points   → wanderPts array inside create()
//  • Sit/stand behaviour  → applyStatusEffect()
//  • Zone positions       → drawFloors() / buildWorkspace / buildKitchen / buildLounge

// ─────────────────────────────────────────────────────────────────────────────

export function PhaserRoom({ agents, healthMap }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<import("phaser").Game | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef     = useRef<any>(null);
  const statusRef    = useRef<Record<string, AgentStatus>>({});
  const healthRef    = useRef<Record<string, HealthResult>>({});

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    let mounted = true;
    let waitForScene: ReturnType<typeof setInterval> | undefined;

    import("phaser").then((Phaser) => {
      if (!mounted || !containerRef.current) return;

      // ── isometric voxel cube helper ────────────────────────────────────────
      function drawIso(
        g: Phaser.GameObjects.Graphics,
        cx: number, cy: number, w: number, h: number,
        topC: number, leftC: number, rightC: number
      ) {
        const d = w / 2;
        g.fillStyle(topC, 1);
        g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+w,cy+d); g.lineTo(cx,cy+d*2); g.lineTo(cx-w,cy+d); g.closePath(); g.fillPath();
        g.fillStyle(leftC, 1);
        g.beginPath(); g.moveTo(cx-w,cy+d); g.lineTo(cx,cy+d*2); g.lineTo(cx,cy+d*2+h); g.lineTo(cx-w,cy+d+h); g.closePath(); g.fillPath();
        g.fillStyle(rightC, 1);
        g.beginPath(); g.moveTo(cx,cy+d*2); g.lineTo(cx+w,cy+d); g.lineTo(cx+w,cy+d+h); g.lineTo(cx,cy+d*2+h); g.closePath(); g.fillPath();
      }

      // ── per-character mutable state ────────────────────────────────────────
      interface CharData {
        agent: Agent;
        container: Phaser.GameObjects.Container;
        bodyGfx: Phaser.GameObjects.Graphics;
        leftLegGfx: Phaser.GameObjects.Graphics;
        rightLegGfx: Phaser.GameObjects.Graphics;
        healthBadge: Phaser.GameObjects.Container;
        statusTxt: Phaser.GameObjects.Text;
        statusBg: Phaser.GameObjects.Graphics;
        nameDot: Phaser.GameObjects.Arc;
        assignedDeskIdx: number;        // -1 = none claimed
        currentStatus: AgentStatus;
        isSitting: boolean;
        isWalking: boolean;
        routineLocked: boolean;
        bobTween: Phaser.Tweens.Tween | null;
        typingTween: Phaser.Tweens.Tween | null;
        healthPulseTween: Phaser.Tweens.Tween | null;
      }

      class OfficeScene extends Phaser.Scene {
        // ── scene-level data ──────────────────────────────────────────────────
        private chars:        Map<string, CharData>  = new Map();
        private deskSeats:    { x: number; y: number }[] = [];   // seat positions
        private deskOccupied: Map<number, string>    = new Map(); // idx → agentId
        private wanderPts:    { x: number; y: number }[] = [];

        constructor() { super({ key: "OfficeScene" }); }
        preload() {}

        create() {
          const W = this.scale.width;
          const H = this.scale.height;

          // ── DESK LAYOUT ─────────────────────────────────────────────────────
          // ox,oy = desk drawing origin  |  sx,sy = character seat  |  depth
          // Add or remove rows here to change number of desks (max = agents.length)
          const DESK_LAYOUT = [
            { ox: W*0.04, oy: H*0.10, sx: W*0.10, sy: H*0.28, depth: 6  }, // back-left
            { ox: W*0.27, oy: H*0.10, sx: W*0.33, sy: H*0.28, depth: 6  }, // back-right
            { ox: W*0.04, oy: H*0.40, sx: W*0.10, sy: H*0.58, depth: 10 }, // front-left
            { ox: W*0.27, oy: H*0.40, sx: W*0.33, sy: H*0.58, depth: 10 }, // front-right
          ];
          this.deskSeats = DESK_LAYOUT.map(d => ({ x: d.sx, y: d.sy }));

          // ── WANDER POINTS (walkable areas in all three zones) ────────────────
          // Add/remove points to control where idle agents walk
          this.wanderPts = [
            { x: W*0.19, y: H*0.36 }, // workspace: corridor between rows
            { x: W*0.46, y: H*0.36 },
            { x: W*0.07, y: H*0.22 }, // workspace: top corners
            { x: W*0.46, y: H*0.22 },
            { x: W*0.07, y: H*0.55 }, // workspace: left corridor
            { x: W*0.19, y: H*0.76 }, // workspace: bottom area
            { x: W*0.46, y: H*0.74 },
            { x: W*0.52, y: H*0.76 }, // doorway into right side
            { x: W*0.68, y: H*0.22 }, // kitchen area
            { x: W*0.84, y: H*0.30 },
            { x: W*0.76, y: H*0.38 },
            { x: W*0.72, y: H*0.66 }, // lounge area
            { x: W*0.86, y: H*0.78 },
            { x: W*0.66, y: H*0.84 },
          ];

          // ── DRAW SCENE ──────────────────────────────────────────────────────
          this.drawBackground(W, H);
          this.drawFloors(W, H);
          this.drawWalls(W, H);
          this.drawDividers(W, H);
          this.buildWorkspaceDecor(W, H);
          this.buildKitchen(W, H);
          this.buildLounge(W, H);

          // ── DESKS + CHAIRS ──────────────────────────────────────────────────
          DESK_LAYOUT.forEach(d => {
            this.buildDesk(d.ox, d.oy);
            const cg = this.add.graphics();
            cg.setDepth(d.depth + 1);
            this.buildChair(cg, d.sx, d.sy);
          });

          // ── CHARACTERS ─────────────────────────────────────────────────────
          const SPAWN = [
            { x: W*0.19, y: H*0.36 },
            { x: W*0.38, y: H*0.46 },
            { x: W*0.10, y: H*0.66 },
            { x: W*0.38, y: H*0.72 },
          ];
          agents.slice(0, DESK_LAYOUT.length).forEach((ag, i) => {
            const sp = SPAWN[i] ?? { x: W*0.20, y: H*0.50 };
            const cd = this.buildVoxelAgent(ag, sp.x, sp.y, 12 + i * 2);
            this.chars.set(ag.id, cd);
            this.applyStatusEffect(cd, ag.status);
            this.time.delayedCall(i * 15_000, () => this.scheduleRoutine(cd));
          });

          sceneRef.current = this;
        }

        // ── SCENE DRAWING ─────────────────────────────────────────────────────

        private drawBackground(W: number, H: number) {
          const g = this.add.graphics();
          g.fillStyle(0x1b2029, 1);
          g.fillRect(0, 0, W, H);
        }

        private drawFloors(W: number, H: number) {
          const g = this.add.graphics();
          const top = H * 0.08;
          // Workspace floor — warm brown
          g.fillStyle(0xc8a97e, 1);
          g.fillRect(0, top, W * 0.575, H - top);
          // Workspace floor grid
          g.lineStyle(1, 0xa07850, 0.22);
          const step = 52;
          for (let x = 0; x < W * 0.575 + H; x += step) {
            g.lineBetween(x, top, x - (H - top), H);
            g.lineBetween(x, top, x + (H - top), H);
          }
          // Kitchen floor — cream/light
          g.fillStyle(0xddd0b8, 1);
          g.fillRect(W * 0.605, top, W * 0.395, H * 0.395);
          // Kitchen grid
          g.lineStyle(1, 0xb8a890, 0.20);
          for (let x = W * 0.605; x < W + H; x += step) {
            g.lineBetween(x, top, x - H * 0.395, top + H * 0.395);
            g.lineBetween(x, top, x + H * 0.395, top + H * 0.395);
          }
          // Lounge floor — muted slate blue
          g.fillStyle(0x8a9bb5, 1);
          g.fillRect(W * 0.605, top + H * 0.425, W * 0.395, H - top - H * 0.425);
          // Lounge subtle grid
          g.lineStyle(1, 0x7a8ba5, 0.20);
          const lTop = top + H * 0.425;
          const lH = H - lTop;
          for (let x = W * 0.605; x < W + lH; x += step) {
            g.lineBetween(x, lTop, x - lH, H);
            g.lineBetween(x, lTop, x + lH, H);
          }
        }

        private drawWalls(W: number, H: number) {
          const g = this.add.graphics();
          const top = H * 0.08;
          // Workspace back wall
          g.fillStyle(0x9e8a72, 1);
          g.fillRect(0, 0, W * 0.575, top);
          g.lineStyle(1.5, 0x8a7060, 0.7);
          g.lineBetween(0, top, W * 0.575, top);
          // Kitchen back wall
          g.fillStyle(0xc8beb0, 1);
          g.fillRect(W * 0.605, 0, W * 0.395, top);
          g.lineStyle(1.5, 0xaaa090, 0.6);
          g.lineBetween(W * 0.605, top, W, top);
          // Room border
          g.lineStyle(3, 0x0d1117, 1);
          g.strokeRect(0, 0, W, H);
        }

        private drawDividers(W: number, H: number) {
          const g = this.add.graphics();
          const top = H * 0.08;
          // ── Vertical divider (workspace | right zones) ──────────────────────
          // Leave a doorway gap at y = H*0.68 to H*0.82
          const dX = W * 0.577;
          const dW = W * 0.028;
          // Wall top segment (no doorway)
          g.fillStyle(0x5a4a3c, 1);
          g.fillRect(dX, top, dW, H * 0.62);
          // Wall side shadow
          g.fillStyle(0x3a2e24, 1);
          g.fillRect(dX - 4, top, 4, H * 0.62);
          // Wall bottom segment (below doorway)
          g.fillStyle(0x5a4a3c, 1);
          g.fillRect(dX, top + H * 0.72, dW, H - top - H * 0.72);
          g.fillStyle(0x3a2e24, 1);
          g.fillRect(dX - 4, top + H * 0.72, 4, H - top - H * 0.72);
          // Doorway frame lines
          g.lineStyle(2, 0x3a2e24, 0.8);
          g.lineBetween(dX, top + H * 0.62, dX, top + H * 0.72);
          g.lineBetween(dX + dW, top + H * 0.62, dX + dW, top + H * 0.72);
          // ── Horizontal divider (kitchen | lounge) ───────────────────────────
          const hY = top + H * 0.40;
          const hH = H * 0.025;
          g.fillStyle(0x6a8090, 1);
          g.fillRect(W * 0.605, hY, W * 0.395, hH);
          g.fillStyle(0x4a6070, 1);
          g.fillRect(W * 0.605, hY, W * 0.395, 3);
        }

        // ── WORKSPACE DECORATION ──────────────────────────────────────────────
        private buildWorkspaceDecor(W: number, H: number) {
          // Two bookshelves along back wall
          this.buildShelf(W * 0.03, H * 0.01, true);
          this.buildShelf(W * 0.27, H * 0.01, true);
          // Plants in corners and along side
          this.buildPlant(W * 0.50, H * 0.12);
          this.buildPlant(W * 0.02, H * 0.82);
          this.buildPlant(W * 0.50, H * 0.82);
          // Small trash bin near left wall
          const tb = this.add.graphics();
          drawIso(tb, W*0.02, H*0.64, 8, 10, 0x3a3a42, 0x28282e, 0x1c1c22);
        }

        // ── KITCHEN / SERVICE AREA ────────────────────────────────────────────
        private buildKitchen(W: number, H: number) {
          const kX = W * 0.61;
          const kY = H * 0.08;
          // Vending machine (left of kitchen)
          this.buildVendingMachine(kX + W*0.02, kY + H*0.04);
          // Water dispenser
          this.buildWaterDispenser(kX + W*0.14, kY + H*0.06);
          // Counter / cabinet along right wall
          this.buildCounter(kX + W*0.25, kY + H*0.02);
          // Wall clock
          this.buildClock(kX + W*0.33, kY + H*0.01, W, H);
          // Small plant on counter
          this.buildPlant(kX + W*0.36, kY + H*0.09);
        }

        // ── MEETING / LOUNGE AREA ─────────────────────────────────────────────
        private buildLounge(W: number, H: number) {
          const lX = W * 0.61;
          const lY = H * 0.08 + H * 0.425;
          // Picture frame on back wall
          this.buildPictureFrame(lX + W*0.14, lY + H*0.01);
          // Bookshelf left side
          this.buildShelf(lX + W*0.00, lY + H*0.04, false);
          // Meeting table (center)
          this.buildMeetingTable(lX + W*0.15, lY + H*0.18);
          // Two chairs around the table
          const cg1 = this.add.graphics(); cg1.setDepth(7);
          this.buildChair(cg1, lX + W*0.13, lY + H*0.26);
          const cg2 = this.add.graphics(); cg2.setDepth(7);
          this.buildChair(cg2, lX + W*0.26, lY + H*0.22);
          // Plants in corners
          this.buildPlant(lX + W*0.01, lY + H*0.32);
          this.buildPlant(lX + W*0.36, lY + H*0.08);
          this.buildPlant(lX + W*0.36, lY + H*0.42);
          // Right bookshelf
          this.buildShelf(lX + W*0.27, lY + H*0.02, false);
        }

        // ── FURNITURE BUILDERS ────────────────────────────────────────────────

        private buildDesk(ox: number, oy: number) {
          const g = this.add.graphics();
          drawIso(g, ox-14, oy+8,  22, 44, 0x4a6fa5, 0x355090, 0x243878);
          drawIso(g, ox-14, oy+46, 26, 10, 0x5a80c0, 0x4060a0, 0x2e4882);
          drawIso(g, ox+32, oy+22, 54, 9,  0x9b7040, 0x7a5528, 0x5a3d18);
          drawIso(g, ox-18, oy+33, 5, 30, 0x5a3d18, 0x3d2810, 0x2a1c08);
          drawIso(g, ox+78, oy+33, 5, 30, 0x5a3d18, 0x3d2810, 0x2a1c08);
          drawIso(g, ox+56, oy+6,  18, 36, 0x222228, 0x161618, 0x0e0e10);
          g.fillStyle(0x1a3a6a, 1);
          g.beginPath(); g.moveTo(ox+56,oy+15); g.lineTo(ox+74,oy+6); g.lineTo(ox+74,oy+38); g.lineTo(ox+56,oy+47); g.closePath(); g.fillPath();
          g.fillStyle(0x4f6ef7, 0.18);
          g.beginPath(); g.moveTo(ox+56,oy+15); g.lineTo(ox+74,oy+6); g.lineTo(ox+74,oy+38); g.lineTo(ox+56,oy+47); g.closePath(); g.fillPath();
          const lines = this.add.graphics();
          lines.lineStyle(1.5, 0x6fa3ef, 0.7);
          [0,1,2,3].forEach(i => { lines.lineBetween(ox+58, oy+18+i*7, ox+58+(14+i*4%8), oy+18+i*7-(i*3%5)); });
          const kb = this.add.graphics();
          kb.fillStyle(0x3a4060, 1);
          kb.beginPath(); kb.moveTo(ox+14,oy+32); kb.lineTo(ox+56,oy+18); kb.lineTo(ox+56,oy+25); kb.lineTo(ox+14,oy+39); kb.closePath(); kb.fillPath();
        }

        private buildChair(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
          const bx=cx-2, by=cy-16, sx=cx-2, sy=cy+10, px=cx, py=sy+16;
          const bsT=0x4a62c0, bsC=0x3a52b0, bsL=0x2a42a0, bsR=0x1a3290;
          const dkC=0x1c1e2c, dkL=0x141620, dkR=0x0c0e14;
          drawIso(g, bx, by-22, 16, 32, bsT, bsL, bsR);
          drawIso(g, sx, sy, 22, 8, bsT, bsC, bsR);
          drawIso(g, px, py, 4, 14, dkC, dkL, dkR);
          drawIso(g, px, py+12, 18, 4, dkC, dkL, dkR);
          drawIso(g, px-14, py+15, 8, 4, dkC, dkL, dkR);
          drawIso(g, px+14, py+15, 8, 4, dkC, dkL, dkR);
        }

        private buildShelf(ox: number, oy: number, colored: boolean) {
          const g = this.add.graphics();
          drawIso(g, ox, oy, 50, 36, 0x7a5528, 0x5a3d18, 0x3e2810);
          // Book spines
          const colors = colored
            ? [0xe05050, 0x4080e0, 0x50c060, 0xe0a030, 0x9050e0, 0xe05090]
            : [0x6070a0, 0x506080, 0x708090, 0x405060, 0x607080, 0x506070];
          colors.forEach((c, i) => {
            drawIso(g, ox - 22 + i*10, oy + 2, 7, 28, c,
              Phaser.Display.Color.ValueToColor(c).darken(25).color,
              Phaser.Display.Color.ValueToColor(c).darken(40).color);
          });
          // Second shelf row
          const colors2 = colored
            ? [0x40c0e0, 0xe06040, 0x80c040]
            : [0x405870, 0x506070, 0x607080];
          colors2.forEach((c, i) => {
            drawIso(g, ox - 12 + i*12, oy + 22, 8, 12, c,
              Phaser.Display.Color.ValueToColor(c).darken(25).color,
              Phaser.Display.Color.ValueToColor(c).darken(40).color);
          });
        }

        private buildPlant(ox: number, oy: number) {
          const g = this.add.graphics();
          drawIso(g, ox, oy+16, 9, 12, 0x7a3a1e, 0x5a2a10, 0x3e1c08);
          drawIso(g, ox, oy+12, 8, 4,  0x3d2510, 0x2a180a, 0x1c1006);
          drawIso(g, ox, oy+2,  4, 12, 0x2d5a1e, 0x1e3e12, 0x122808);
          drawIso(g, ox, oy-8,  14, 10, 0x2a7a28, 0x1a5a1a, 0x0e3e10);
          drawIso(g, ox, oy-18, 10, 8,  0x38a030, 0x267a22, 0x185214);
          drawIso(g, ox, oy-26, 6, 6,   0x48b83c, 0x309028, 0x1e6018);
        }

        private buildVendingMachine(ox: number, oy: number) {
          const g = this.add.graphics();
          drawIso(g, ox, oy, 22, 52, 0x2a4a6a, 0x1a3a5a, 0x0e2848);
          // Display panel
          g.fillStyle(0x80c8ff, 0.9);
          g.fillRect(ox-8, oy+10, 16, 20);
          // Items grid
          g.fillStyle(0xffb040, 0.8); g.fillRect(ox-6, oy+12, 5, 5);
          g.fillStyle(0xff5050, 0.8); g.fillRect(ox+2,  oy+12, 5, 5);
          g.fillStyle(0x50ff80, 0.8); g.fillRect(ox-6, oy+19, 5, 5);
          g.fillStyle(0xff80c0, 0.8); g.fillRect(ox+2,  oy+19, 5, 5);
          // Coin slot
          g.fillStyle(0x888888, 1); g.fillRect(ox+8, oy+28, 4, 2);
        }

        private buildWaterDispenser(ox: number, oy: number) {
          const g = this.add.graphics();
          // Bottle (blue top)
          drawIso(g, ox, oy, 12, 18, 0x4090d0, 0x2070b0, 0x105090);
          // Base unit
          drawIso(g, ox, oy+16, 14, 16, 0xd0ccc4, 0xb0aca4, 0x908c84);
          // Tap
          g.fillStyle(0x5090c0, 1);
          g.fillRect(ox+12, oy+26, 4, 4);
          g.fillRect(ox+16, oy+28, 4, 2);
        }

        private buildCounter(ox: number, oy: number) {
          const g = this.add.graphics();
          drawIso(g, ox, oy, 40, 8,  0xc8a870, 0xa88850, 0x886830);
          drawIso(g, ox, oy+6, 38, 22, 0xa88040, 0x886020, 0x684010);
          // Coffee cup
          g.fillStyle(0x6a4020, 1); g.fillEllipse(ox+8, oy+8, 8, 4);
          g.fillStyle(0x4a2010, 1); g.fillRect(ox+4, oy+8, 8, 6);
        }

        private buildClock(ox: number, oy: number, W: number, H: number) {
          const g = this.add.graphics();
          g.fillStyle(0xf0ead8, 1); g.fillCircle(ox, oy, 14);
          g.lineStyle(2, 0x8a7060, 1); g.strokeCircle(ox, oy, 14);
          g.lineStyle(2, 0x2a2018, 1);
          g.lineBetween(ox, oy, ox, oy - 9);       // hour hand
          g.lineBetween(ox, oy, ox + 8, oy - 4);   // minute hand
          g.fillStyle(0x2a2018, 1); g.fillCircle(ox, oy, 2);
        }

        private buildMeetingTable(ox: number, oy: number) {
          const g = this.add.graphics();
          drawIso(g, ox, oy, 44, 6, 0x9b7040, 0x7a5528, 0x5a3d18);
          drawIso(g, ox-14, oy+5, 5, 18, 0x5a3d18, 0x3d2810, 0x2a1c08);
          drawIso(g, ox+14, oy+5, 5, 18, 0x5a3d18, 0x3d2810, 0x2a1c08);
          // Laptop on table
          drawIso(g, ox+4, oy-2, 16, 2, 0x2a2a32, 0x1c1c22, 0x121216);
          g.fillStyle(0x3a6a9a, 0.9);
          g.beginPath(); g.moveTo(ox+4,oy-2); g.lineTo(ox+20,oy+6); g.lineTo(ox+20,oy+20); g.lineTo(ox+4,oy+12); g.closePath(); g.fillPath();
        }

        private buildPictureFrame(ox: number, oy: number) {
          const g = this.add.graphics();
          drawIso(g, ox, oy, 36, 2, 0x7a5528, 0x5a3d18, 0x3e2810);
          // Frame face
          g.fillStyle(0x7a5528, 1);
          g.fillRect(ox-18, oy-30, 36, 32);
          // Sky
          g.fillStyle(0x6090d0, 1); g.fillRect(ox-14, oy-27, 28, 15);
          // Landscape
          g.fillStyle(0x40a050, 1); g.fillRect(ox-14, oy-13, 28, 11);
          // Sun
          g.fillStyle(0xffd050, 1); g.fillCircle(ox+8, oy-22, 5);
        }

        // ── CHARACTER BUILDING ────────────────────────────────────────────────

        private buildVoxelAgent(ag: Agent, x: number, y: number, depth: number): CharData {
          const pantsC=0x3d4a6e, pantsL=0x2d3a5e, pantsR=0x1d2a4e;
          const shadowGfx = this.add.graphics();
          shadowGfx.fillStyle(0x000000, 0.28); shadowGfx.fillEllipse(0, 48, 36, 12);
          const bodyGfx = this.add.graphics();
          const leftLegGfx = this.add.graphics();
          drawIso(leftLegGfx, -9, 18, 8, 20, pantsC, pantsL, pantsR);
          drawIso(leftLegGfx, -9, 36, 9, 6, 0x1a1a2e, 0x111122, 0x0a0a18);
          const rightLegGfx = this.add.graphics();
          drawIso(rightLegGfx, 9, 18, 8, 20, pantsC, pantsL, pantsR);
          drawIso(rightLegGfx, 9, 36, 9, 6, 0x1a1a2e, 0x111122, 0x0a0a18);
          // Name badge
          const nbg = this.add.graphics();
          const dotC = this.statusHex(ag.status);
          const bw = ag.name.length * 9 + 40;
          nbg.fillStyle(0x0f1322, 0.92); nbg.fillRoundedRect(-bw/2,-15,bw,30,5);
          nbg.fillStyle(dotC, 1); nbg.fillRect(-bw/2,-15,4,30);
          const nameTxt = this.add.text(-bw/2+12, 0, ag.name.toUpperCase(),
            { fontSize:"12px", color:"#ffffff", fontFamily:"Inter, system-ui, sans-serif", fontStyle:"700" }
          ).setOrigin(0, 0.5);
          const nameDot = this.add.circle(bw/2-12, 0, 5, dotC);
          const nameBadge = this.add.container(0, -100, [nbg, nameTxt, nameDot]);
          // Status badge
          const statusBg = this.add.graphics();
          const stLabel = this.statusText(ag.status);
          const sw = stLabel.length * 8 + 28;
          statusBg.fillStyle(0x1e2438, 0.92); statusBg.fillRoundedRect(-sw/2,-13,sw,26,13);
          const statusTxt = this.add.text(0, 0, stLabel, {
            fontSize:"12px", color: this.statusColor(ag.status),
            fontFamily:"Inter, system-ui, sans-serif", fontStyle:"600",
          }).setOrigin(0.5);
          const statusBadge = this.add.container(0, 68, [statusBg, statusTxt]);
          // Health badge
          const hBg = this.add.graphics();
          hBg.fillStyle(0xef4444, 1); hBg.fillCircle(0, 0, 10);
          const hTxt = this.add.text(0, 0, "!", {
            fontSize:"13px", color:"#ffffff", fontFamily:"Inter, system-ui, sans-serif", fontStyle:"800",
          }).setOrigin(0.5);
          const healthBadge = this.add.container(28, -128, [hBg, hTxt]);
          healthBadge.setVisible(false);
          const container = this.add.container(x, y, [
            shadowGfx, leftLegGfx, rightLegGfx, bodyGfx,
            nameBadge, statusBadge, healthBadge
          ]);
          container.setDepth(depth);
          const cd: CharData = {
            agent: ag, container, bodyGfx, leftLegGfx, rightLegGfx,
            healthBadge, statusTxt, statusBg, nameDot,
            assignedDeskIdx: -1,
            currentStatus: ag.status,
            isSitting: false, isWalking: false, routineLocked: false,
            bobTween: null, typingTween: null, healthPulseTween: null,
          };
          this.redrawBody(cd, false);
          return cd;
        }

        private redrawBody(cd: CharData, sitting: boolean) {
          if (!cd.bodyGfx) return;
          const shirtC = this.avatarColor(cd.agent.avatar_style);
          const shirtT = Phaser.Display.Color.ValueToColor(shirtC).lighten(8).color;
          const shirtL = Phaser.Display.Color.ValueToColor(shirtC).darken(22).color;
          const shirtR = Phaser.Display.Color.ValueToColor(shirtC).darken(40).color;
          const skinC=0xc8915a, skinL=0xa87040, skinR=0x8a5a2e;
          const hairC=0x2c1b0e, hairL=0x1e1208, hairR=0x120c04;
          cd.bodyGfx.clear();
          drawIso(cd.bodyGfx, 0, -68, 22, 10, hairC, hairL, hairR);
          drawIso(cd.bodyGfx, 0, -46, 20, 26, skinC, skinL, skinR);
          cd.bodyGfx.fillStyle(0x1a1020,1); cd.bodyGfx.fillRect(-12,-32,6,6); cd.bodyGfx.fillRect(6,-32,6,6);
          cd.bodyGfx.fillStyle(0x9a6030,0.7); cd.bodyGfx.fillRect(-5,-20,10,2);
          drawIso(cd.bodyGfx, 0, -12, 18, 22, shirtT, shirtL, shirtR);
          if (sitting) {
            drawIso(cd.bodyGfx, -14, 8, 8, 10, skinC, skinL, skinR);
            drawIso(cd.bodyGfx,  14, 8, 8, 10, skinC, skinL, skinR);
          } else {
            drawIso(cd.bodyGfx, -26, -8, 8, 22, skinC, skinL, skinR);
            drawIso(cd.bodyGfx,  26, -8, 8, 22, skinC, skinL, skinR);
          }
        }

        private setSitting(cd: CharData, sitting: boolean) {
          cd.isSitting = sitting;
          cd.leftLegGfx?.setVisible(!sitting);
          cd.rightLegGfx?.setVisible(!sitting);
          if (!sitting) { cd.leftLegGfx && (cd.leftLegGfx.y=0); cd.rightLegGfx && (cd.rightLegGfx.y=0); }
          this.redrawBody(cd, sitting);
        }

        private refreshBadge(cd: CharData, status: AgentStatus) {
          if (!cd.statusTxt) return;
          const label = this.statusText(status);
          cd.statusTxt.setText(label); cd.statusTxt.setColor(this.statusColor(status));
          cd.nameDot?.setFillStyle(this.statusHex(status));
          if (cd.statusBg) {
            cd.statusBg.clear();
            const sw = label.length * 8 + 28;
            cd.statusBg.fillStyle(0x1e2438, 0.92); cd.statusBg.fillRoundedRect(-sw/2,-13,sw,26,13);
          }
        }

        // ── desk claim / release ──────────────────────────────────────────
        private claimDesk(cd: CharData): { x: number; y: number } | null {
          // If already assigned, return that desk
          if (cd.assignedDeskIdx >= 0) {
            const d = this.deskSeats[cd.assignedDeskIdx];
            return d ?? null;
          }
          // Find a free desk
          for (let i = 0; i < this.deskSeats.length; i++) {
            if (!this.deskOccupied.has(i)) {
              this.deskOccupied.set(i, cd.agent.id);
              cd.assignedDeskIdx = i;
              return this.deskSeats[i];
            }
          }
          return null; // all desks full — will wander
        }

        private releaseDesk(cd: CharData) {
          if (cd.assignedDeskIdx >= 0) {
            this.deskOccupied.delete(cd.assignedDeskIdx);
            cd.assignedDeskIdx = -1;
          }
        }

        // ── status effects ────────────────────────────────────────────────
        private applyStatusEffect(cd: CharData, status: AgentStatus) {
          this.stopTyping(cd);
          if (cd.bobTween) { cd.bobTween.stop(); cd.bobTween = null; }
          if (cd.healthPulseTween) { cd.healthPulseTween.stop(); cd.healthPulseTween = null; }

          cd.container?.setScale(1);

          if (status === "working" || status === "replying") {
            const seat = this.claimDesk(cd);
            if (seat) {
              this.routedMoveTo(cd, seat.x, seat.y, WALK_SPEED, () => {
                this.setSitting(cd, true);
                if (status === "working") this.playTyping(cd);
                else {
                  // bounce animation for replying
                  cd.bobTween = this.tweens.add({
                    targets: cd.container,
                    y: "-=6",
                    duration: 320,
                    yoyo: true,
                    repeat: -1,
                    ease: "Sine.easeInOut",
                  });
                }
              });
            } else {
              // No desk — stay and show busy
              this.setSitting(cd, false);
              if (status === "working") this.playTyping(cd);
            }
          } else if (status === "error") {
            this.setSitting(cd, false);
            this.releaseDesk(cd);
            cd.healthPulseTween = this.tweens.add({
              targets: cd.container,
              scaleX: 1.12,
              scaleY: 1.12,
              duration: 260,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
            this.startWander(cd);
          } else {
            // idle / offline
            this.setSitting(cd, false);
            this.releaseDesk(cd);
            this.startWander(cd);
          }
        }

        private setStatusInternal(cd: CharData, status: AgentStatus) {
          if (cd.currentStatus === status) return;
          cd.currentStatus = status;
          cd.agent = { ...cd.agent, status };
          this.refreshBadge(cd, status);
          cd.routineLocked = true;
          this.applyStatusEffect(cd, status);
          // Auto-reset timers
          if (status === "working") {
            this.time.delayedCall(WORKING_TIMEOUT, () => {
              if (cd.currentStatus === "working") this.setStatusInternal(cd, "idle");
            });
          } else if (status === "replying") {
            this.time.delayedCall(REPLYING_TIMEOUT, () => {
              if (cd.currentStatus === "replying") this.setStatusInternal(cd, "idle");
            });
          }
        }

        // Public API ─────────────────────────────────────────────────────
        updateStatus(agentId: string, status: AgentStatus) {
          const cd = this.chars.get(agentId);
          if (!cd) return;
          this.setStatusInternal(cd, status);
        }

        updateHealth(agentId: string, _health: unknown) {
          const cd = this.chars.get(agentId);
          if (!cd) return;
          this.refreshBadge(cd, cd.currentStatus);
        }

        // ── movement ──────────────────────────────────────────────────────
        private moveTo(cd: CharData, tx: number, ty: number, dur: number, onComplete?: () => void) {
          cd.isWalking = true;
          this.tweens.add({
            targets: cd.container,
            x: tx,
            y: ty,
            duration: Math.max(200, dur),
            ease: "Sine.easeInOut",
            onComplete: () => {
              cd.isWalking = false;
              onComplete?.();
            },
          });
        }

        // Route through doorway when crossing between left and right zones
        private routedMoveTo(cd: CharData, tx: number, ty: number, totalDur: number, onComplete?: () => void) {
          const W = this.scale.width;
          const H = this.scale.height;
          const DIV_X  = W * 0.577;
          const DIV_W  = W * 0.028;
          const DOOR_Y = H * 0.08 + H * 0.67; // vertical center of doorway gap
          const L_DOOR = DIV_X - 28;            // just left of wall
          const R_DOOR = DIV_X + DIV_W + 28;    // just right of wall

          const fromX = cd.container?.x ?? 0;
          const fromY = cd.container?.y ?? 0;
          const crossingToRight = fromX < DIV_X && tx > DIV_X + DIV_W;
          const crossingToLeft  = fromX > DIV_X + DIV_W && tx < DIV_X;

          if (!crossingToRight && !crossingToLeft) {
            this.moveTo(cd, tx, ty, totalDur, onComplete);
            return;
          }

          // Build waypoints: [doorEntry, doorExit, dest]
          const wp1x = crossingToRight ? L_DOOR : R_DOOR;
          const wp2x = crossingToRight ? R_DOOR : L_DOOR;

          const d0 = Phaser.Math.Distance.Between(fromX, fromY, wp1x, DOOR_Y);
          const d1 = Phaser.Math.Distance.Between(wp1x, DOOR_Y, wp2x, DOOR_Y);
          const d2 = Phaser.Math.Distance.Between(wp2x, DOOR_Y, tx, ty);
          const total = d0 + d1 + d2 || 1;

          this.moveTo(cd, wp1x, DOOR_Y, totalDur * (d0 / total), () => {
            this.moveTo(cd, wp2x, DOOR_Y, totalDur * (d1 / total), () => {
              this.moveTo(cd, tx, ty, totalDur * (d2 / total), onComplete);
            });
          });
        }

        private startWander(cd: CharData) {
          if (cd.isSitting) this.setSitting(cd, false);
          cd.routineLocked = false;
          this.scheduleRoutine(cd);
        }

        private scheduleRoutine(cd: CharData) {
          if (cd.routineLocked) return;
          const pts = this.wanderPts;

          // Avoid points already occupied by other agents (collision avoidance)
          const myX = cd.container?.x ?? 0;
          const myY = cd.container?.y ?? 0;
          const free = pts.filter(p => {
            let taken = false;
            this.chars.forEach((other) => {
              if (other.agent.id === cd.agent.id) return;
              const ox = other.container?.x ?? 0;
              const oy = other.container?.y ?? 0;
              if (Phaser.Math.Distance.Between(ox, oy, p.x, p.y) < 60) taken = true;
            });
            return !taken;
          });
          const pool = free.length > 0 ? free : pts;
          const target = pool[Math.floor(Math.random() * pool.length)];

          const dist = Phaser.Math.Distance.Between(myX, myY, target.x, target.y);
          const dur = Math.max(WANDER_SPEED * 0.4, (dist / 160) * WANDER_SPEED);
          this.routedMoveTo(cd, target.x, target.y, dur, () => {
            if (!cd.routineLocked) {
              this.time.delayedCall(WANDER_PAUSE + Math.random() * 800, () => {
                this.scheduleRoutine(cd);
              });
            }
          });
        }

        private playTyping(cd: CharData) {
          if (!cd.rightLegGfx) return; // reuse leg object as "hand" bob
          cd.typingTween = this.tweens.add({
            targets: cd.rightLegGfx,
            y: -3,
            duration: 180,
            yoyo: true,
            repeat: -1,
            ease: "Stepped(2)",
          });
        }

        private stopTyping(cd: CharData) {
          if (cd.typingTween) { cd.typingTween.stop(); cd.typingTween = null; }
          cd.rightLegGfx && (cd.rightLegGfx.y = 0);
        }

        // ── walking leg animation ─────────────────────────────────────────
        update(time: number) {
          this.chars.forEach((cd) => {
            if (!cd.isWalking || cd.isSitting) return;
            const phase = (time % 600) / 600;
            const angle = Math.sin(phase * Math.PI * 2);
            if (cd.leftLegGfx)  cd.leftLegGfx.y  =  angle * 5;
            if (cd.rightLegGfx) cd.rightLegGfx.y = -angle * 5;
          });
        }

        // ── color helpers ─────────────────────────────────────────────────
        private avatarColor(style: string): number {
          const map: Record<string, number> = {
            blue:   0x3b82f6,
            purple: 0xa855f7,
            green:  0x10b981,
            amber:  0xf59e0b,
            pink:   0xec4899,
            cyan:   0x06b6d4,
          };
          return map[style] ?? 0x6366f1;
        }

        private statusColor(s: AgentStatus): string {
          const m: Record<AgentStatus, string> = {
            idle: "#94a3b8", working: "#fbbf24", replying: "#6366f1", error: "#f87171"
          };
          return m[s] ?? "#94a3b8";
        }

        private statusHex(s: AgentStatus): number {
          const m: Record<AgentStatus, number> = {
            idle: 0x94a3b8, working: 0xfbbf24, replying: 0x6366f1, error: 0xf87171
          };
          return m[s] ?? 0x94a3b8;
        }

        private statusText(s: AgentStatus): string {
          const m: Record<AgentStatus, string> = {
            idle: "Idle", working: "Working…", replying: "Replying…", error: "Error"
          };
          return m[s] ?? s;
        }
      }

      // ── Phaser game init ──────────────────────────────────────────────────
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 900,
        height: 600,
        backgroundColor: "#0f1117",
        parent: containerRef.current!,
        scene: [OfficeScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: { antialias: true },
      });

      gameRef.current = game;

      // ── push status & health into scene once it's ready ──────────────────
      waitForScene = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scene = game.scene.getScene("OfficeScene") as any;
        if (!scene || !scene.sys.isActive()) return;
        clearInterval(waitForScene);

        // initial statuses
        for (const ag of agents) {
          scene.updateStatus(ag.id, ag.status);
        }

        sceneRef.current = scene;
        statusRef.current = Object.fromEntries(agents.map((a) => [a.id, a.status]));
        healthRef.current = healthMap ?? {};
      }, 100);

    }); // end import("phaser").then

    return () => {
      mounted = false;
      clearInterval(waitForScene);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    // ── propagate live status changes ────────────────────────────────────
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      for (const ag of agents) {
        const prev = statusRef.current[ag.id];
        if (prev !== ag.status) {
          scene.updateStatus(ag.id, ag.status);
          statusRef.current[ag.id] = ag.status;
        }
      }
    }, [agents]);

    // ── propagate health changes ─────────────────────────────────────────
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      for (const [id, h] of Object.entries(healthMap ?? {})) {
        const prev = healthRef.current[id];
        if (!prev || prev.label !== h.label) {
          scene.updateHealth(id, h);
          healthRef.current[id] = h;
        }
      }
    }, [healthMap]);

    return <div ref={containerRef} className="w-full h-full" />;
  }
