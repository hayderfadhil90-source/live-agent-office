"use client";

import { useEffect, useRef } from "react";
import type { Agent, AgentStatus } from "@/lib/types";

interface Props { agent: Agent; }

const WORK_INTERVAL = 60 * 60 * 1000;
const REST_INTERVAL = 20 * 60 * 1000;
const WORK_DURATION = 5  * 60 * 1000;
const REST_DURATION = 3  * 60 * 1000;

export function PhaserRoom({ agent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<import("phaser").Game | null>(null);
  const sceneRef     = useRef<OfficeScene | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    let mounted = true;

    import("phaser").then((Phaser) => {
      if (!mounted || !containerRef.current) return;

      // ─── Helper: draw one isometric voxel cube ──────────────────────
      function drawIso(
        g: Phaser.GameObjects.Graphics,
        cx: number, cy: number,
        w: number, h: number,
        topC: number, leftC: number, rightC: number
      ) {
        const d = w / 2;

        g.fillStyle(topC, 1);
        g.beginPath();
        g.moveTo(cx,     cy);
        g.lineTo(cx + w, cy + d);
        g.lineTo(cx,     cy + d * 2);
        g.lineTo(cx - w, cy + d);
        g.closePath();
        g.fillPath();

        g.fillStyle(leftC, 1);
        g.beginPath();
        g.moveTo(cx - w, cy + d);
        g.lineTo(cx,     cy + d * 2);
        g.lineTo(cx,     cy + d * 2 + h);
        g.lineTo(cx - w, cy + d + h);
        g.closePath();
        g.fillPath();

        g.fillStyle(rightC, 1);
        g.beginPath();
        g.moveTo(cx,     cy + d * 2);
        g.lineTo(cx + w, cy + d);
        g.lineTo(cx + w, cy + d + h);
        g.lineTo(cx,     cy + d * 2 + h);
        g.closePath();
        g.fillPath();
      }

      class OfficeScene extends Phaser.Scene {
        private agentC!: Phaser.GameObjects.Container;
        private nameDot!: Phaser.GameObjects.Arc;
        private statusTxt!: Phaser.GameObjects.Text;
        private statusBg!: Phaser.GameObjects.Graphics;
        private currentStatus: AgentStatus = agent.status;
        private bobTween: Phaser.Tweens.Tween | null = null;
        private routineLocked = false;

        // Character parts for animation
        private leftLegGfx!: Phaser.GameObjects.Graphics;
        private rightLegGfx!: Phaser.GameObjects.Graphics;
        private bodyGfx!: Phaser.GameObjects.Graphics;
        private isSitting = false;
        private isWalking = false;

        private deskPos!:   {x:number;y:number};
        private sofaPos!:   {x:number;y:number};
        private centerPos!: {x:number;y:number};
        private wanderPts!: {x:number;y:number}[];

        constructor() { super({ key: "OfficeScene" }); }
        preload() {}

        create() {
          const W = this.scale.width;
          const H = this.scale.height;

          this.deskPos   = { x: W * 0.26, y: H * 0.40 };
          this.sofaPos   = { x: W * 0.72, y: H * 0.33 };
          this.centerPos = { x: W * 0.47, y: H * 0.58 };
          this.wanderPts = [
            { x: W*0.33, y: H*0.52 },
            { x: W*0.55, y: H*0.42 },
            { x: W*0.62, y: H*0.62 },
            { x: W*0.38, y: H*0.68 },
          ];

          // ── Dark background
          const bg = this.add.graphics();
          bg.fillStyle(0x1b2029, 1);
          bg.fillRect(0, 0, W, H);

          // ── Walls
          const roomG = this.add.graphics();
          const apexX = W * 0.50, apexY = H * 0.04;
          const wallBase = H * 0.22;

          // Left wall (lighter warm brown)
          roomG.fillStyle(0x9e8a72, 1);
          roomG.beginPath();
          roomG.moveTo(0,      0);
          roomG.lineTo(apexX,  apexY);
          roomG.lineTo(apexX,  wallBase);
          roomG.lineTo(0,      wallBase);
          roomG.closePath();
          roomG.fillPath();

          // Right wall (darker warm brown)
          roomG.fillStyle(0x7d6a56, 1);
          roomG.beginPath();
          roomG.moveTo(W,      0);
          roomG.lineTo(apexX,  apexY);
          roomG.lineTo(apexX,  wallBase);
          roomG.lineTo(W,      wallBase);
          roomG.closePath();
          roomG.fillPath();

          // Wall ridge
          roomG.lineStyle(2, 0xc4a882, 1);
          roomG.lineBetween(apexX, apexY, apexX, wallBase);

          // Floor-wall seam
          roomG.lineStyle(1.5, 0x8a7060, 0.7);
          roomG.lineBetween(0, wallBase, W, wallBase);

          // ── Floor: light Claw3D beige
          const floorG = this.add.graphics();
          floorG.fillStyle(0xc8a97e, 1);
          floorG.fillRect(0, wallBase, W, H - wallBase);

          // ── Diagonal grid on floor
          const gridG = this.add.graphics();
          gridG.lineStyle(1, 0xa07850, 0.28);
          const gridStep = 58;
          const floorH = H - wallBase;
          for (let x = -floorH * 2; x < W + floorH * 2; x += gridStep) {
            gridG.lineBetween(x, wallBase, x + floorH, H);
          }
          for (let x = -floorH * 2; x < W + floorH * 2; x += gridStep) {
            gridG.lineBetween(x, wallBase, x - floorH, H);
          }

          this.buildDeskScene(W*0.22, H*0.18);
          this.buildSofaScene(W*0.65, H*0.14);

          this.agentC = this.buildVoxelAgent(agent.pos_x, agent.pos_y);
          this.applyStatusEffect(agent.status);
          this.scheduleRoutine();

          sceneRef.current = this;
        }

        private buildDeskScene(ox: number, oy: number) {
          const g = this.add.graphics();

          drawIso(g, ox-14, oy+8,  22, 44, 0x4a6fa5, 0x355090, 0x243878);
          drawIso(g, ox-14, oy+46, 26, 10, 0x5a80c0, 0x4060a0, 0x2e4882);

          drawIso(g, ox+32, oy+22, 54, 9,  0x9b7040, 0x7a5528, 0x5a3d18);
          drawIso(g, ox-18, oy+33, 5, 30, 0x5a3d18, 0x3d2810, 0x2a1c08);
          drawIso(g, ox+78, oy+33, 5, 30, 0x5a3d18, 0x3d2810, 0x2a1c08);
          drawIso(g, ox-18, oy+60, 5, 5,  0x3d2810, 0x2a1c08, 0x1c1006);
          drawIso(g, ox+78, oy+60, 5, 5,  0x3d2810, 0x2a1c08, 0x1c1006);

          drawIso(g, ox+56, oy+6,  18, 36, 0x222228, 0x161618, 0x0e0e10);
          g.fillStyle(0x1a3a6a, 1);
          g.beginPath();
          g.moveTo(ox+56, oy+15);
          g.lineTo(ox+74, oy+6);
          g.lineTo(ox+74, oy+38);
          g.lineTo(ox+56, oy+47);
          g.closePath();
          g.fillPath();
          g.fillStyle(0x4f6ef7, 0.18);
          g.beginPath();
          g.moveTo(ox+56, oy+15);
          g.lineTo(ox+74, oy+6);
          g.lineTo(ox+74, oy+38);
          g.lineTo(ox+56, oy+47);
          g.closePath();
          g.fillPath();

          const lines = this.add.graphics();
          lines.lineStyle(1.5, 0x6fa3ef, 0.7);
          [0,1,2,3].forEach(i => {
            const x1 = ox+58, x2 = ox+58 + (14 + i*4 % 8);
            const y1 = oy+18 + i*7;
            const y2 = y1 - (i*3 % 5);
            lines.lineBetween(x1, y1, x2, y2);
          });

          const kb = this.add.graphics();
          kb.fillStyle(0x3a4060, 1);
          kb.beginPath();
          kb.moveTo(ox+14, oy+32);
          kb.lineTo(ox+56, oy+18);
          kb.lineTo(ox+56, oy+25);
          kb.lineTo(ox+14, oy+39);
          kb.closePath();
          kb.fillPath();
        }

        private buildSofaScene(ox: number, oy: number) {
          const g = this.add.graphics();
          drawIso(g, ox, oy,    50, 40, 0x2e3a5c, 0x1e2a4c, 0x121e3a);
          drawIso(g, ox, oy+36, 55, 14, 0x3a4878, 0x2a3868, 0x1a2858);
          drawIso(g, ox-44, oy+16, 10, 30, 0x2e3a5c, 0x1e2a4c, 0x121e3a);
          drawIso(g, ox+44, oy+16, 10, 30, 0x2e3a5c, 0x1e2a4c, 0x121e3a);
          drawIso(g, ox-16, oy+34, 22, 10, 0x444e7a, 0x343e6a, 0x242e5a);
          drawIso(g, ox+16, oy+34, 22, 10, 0x444e7a, 0x343e6a, 0x242e5a);
          drawIso(g, ox+2, oy+78, 32, 5, 0x22263c, 0x161a2e, 0x0e1020);
          drawIso(g, ox-22, oy+84, 4, 14, 0x161a2e, 0x0e1020, 0x080c18);
          drawIso(g, ox+26, oy+84, 4, 14, 0x161a2e, 0x0e1020, 0x080c18);

          drawIso(g, ox - 62, oy + 58, 9, 12, 0x7a3a1e, 0x5a2a10, 0x3e1c08);
          drawIso(g, ox - 62, oy + 55, 8, 3, 0x3d2510, 0x2a180a, 0x1c1006);
          drawIso(g, ox - 62, oy + 40, 4, 16, 0x2d5a1e, 0x1e3e12, 0x122808);
          drawIso(g, ox - 62, oy + 30, 14, 10, 0x2a7a28, 0x1a5a1a, 0x0e3e10);
          drawIso(g, ox - 62, oy + 16, 10, 8, 0x38a030, 0x267a22, 0x185214);
          drawIso(g, ox - 62, oy + 6,  6, 6, 0x48b83c, 0x309028, 0x1e6018);

          drawIso(g, ox + 72, oy + 58, 10, 4, 0x1e1e22, 0x141416, 0x0c0c0e);
          drawIso(g, ox + 72, oy + 46, 3, 14, 0x2a2a32, 0x1c1c22, 0x121216);
          drawIso(g, ox + 72, oy + 34, 3, 12, 0x2a2a32, 0x1c1c22, 0x121216);
          drawIso(g, ox + 72, oy + 22, 3, 12, 0x2a2a32, 0x1c1c22, 0x121216);
          drawIso(g, ox + 72, oy + 8,  14, 10, 0xf0d080, 0xc8a840, 0xa07820);
          g.fillStyle(0xffe080, 0.10);
          g.fillEllipse(ox + 72 + 14, oy + 18, 44, 22);
        }

        // Toggle sitting/standing pose
        private setSitting(sitting: boolean) {
          this.isSitting = sitting;
          if (this.leftLegGfx) this.leftLegGfx.setVisible(!sitting);
          if (this.rightLegGfx) this.rightLegGfx.setVisible(!sitting);
          // Reset leg positions when standing
          if (!sitting) {
            if (this.leftLegGfx)  this.leftLegGfx.y  = 0;
            if (this.rightLegGfx) this.rightLegGfx.y = 0;
          }
          // Redraw body for sitting/standing arms
          this.redrawBody(sitting);
        }

        private redrawBody(sitting: boolean) {
          if (!this.bodyGfx) return;
          const shirtC = this.avatarColor(agent.avatar_style);
          const shirtT = Phaser.Display.Color.ValueToColor(shirtC).lighten(8).color;
          const shirtL = Phaser.Display.Color.ValueToColor(shirtC).darken(22).color;
          const shirtR = Phaser.Display.Color.ValueToColor(shirtC).darken(40).color;
          const skinC = 0xc8915a; const skinL = 0xa87040; const skinR = 0x8a5a2e;
          const hairC = 0x2c1b0e; const hairL = 0x1e1208; const hairR = 0x120c04;
          this.bodyGfx.clear();
          // Hair
          drawIso(this.bodyGfx, 0, -68, 22, 10, hairC, hairL, hairR);
          // Head (big cubic)
          drawIso(this.bodyGfx, 0, -46, 20, 26, skinC, skinL, skinR);
          // Eyes
          this.bodyGfx.fillStyle(0x1a1020, 1);
          this.bodyGfx.fillRect(-12, -32, 6, 6);
          this.bodyGfx.fillRect(6,   -32, 6, 6);
          // Mouth
          this.bodyGfx.fillStyle(0x9a6030, 0.7);
          this.bodyGfx.fillRect(-5, -20, 10, 2);
          // Torso
          drawIso(this.bodyGfx, 0, -12, 18, 22, shirtT, shirtL, shirtR);
          if (sitting) {
            // Arms forward on desk
            drawIso(this.bodyGfx, -14, 8, 8, 10, skinC, skinL, skinR);
            drawIso(this.bodyGfx,  14, 8, 8, 10, skinC, skinL, skinR);
          } else {
            // Arms at sides
            drawIso(this.bodyGfx, -26, -8, 8, 22, skinC, skinL, skinR);
            drawIso(this.bodyGfx,  26, -8, 8, 22, skinC, skinL, skinR);
          }
        }

        private buildVoxelAgent(x: number, y: number): Phaser.GameObjects.Container {
          const pantsC = 0x3d4a6e;
          const pantsL = 0x2d3a5e;
          const pantsR = 0x1d2a4e;

          // Shadow
          const shadowGfx = this.add.graphics();
          shadowGfx.fillStyle(0x000000, 0.28);
          shadowGfx.fillEllipse(0, 48, 36, 12);

          // Body (head + torso + arms) — redrawn on sit/stand
          this.bodyGfx = this.add.graphics();
          this.redrawBody(false);

          // Legs (separate for walking animation)
          this.leftLegGfx = this.add.graphics();
          drawIso(this.leftLegGfx, -9, 18, 8, 20, pantsC, pantsL, pantsR);
          // Shoes
          drawIso(this.leftLegGfx, -9, 36, 9, 6, 0x1a1a2e, 0x111122, 0x0a0a18);

          this.rightLegGfx = this.add.graphics();
          drawIso(this.rightLegGfx, 9, 18, 8, 20, pantsC, pantsL, pantsR);
          drawIso(this.rightLegGfx, 9, 36, 9, 6, 0x1a1a2e, 0x111122, 0x0a0a18);

          const nbg = this.add.graphics();
          const dotC = this.statusHex(agent.status);
          const bw = agent.name.length * 9 + 40;
          nbg.fillStyle(0x0f1322, 0.92);
          nbg.fillRoundedRect(-bw/2, -15, bw, 30, 5);
          nbg.fillStyle(dotC, 1);
          nbg.fillRect(-bw/2, -15, 4, 30);

          const nameTxt = this.add.text(
            -bw/2 + 12, 0,
            agent.name.toUpperCase(),
            { fontSize:"12px", color:"#ffffff",
              fontFamily:"Inter, system-ui, sans-serif", fontStyle:"700" }
          ).setOrigin(0, 0.5);

          this.nameDot = this.add.circle(bw/2 - 12, 0, 5, dotC);
          const nameBadge = this.add.container(0, -100, [nbg, nameTxt, this.nameDot]);

          this.statusBg = this.add.graphics();
          const stLabel = this.statusText(agent.status);
          const sw = stLabel.length * 8 + 28;
          this.statusBg.fillStyle(0x1e2438, 0.92);
          this.statusBg.fillRoundedRect(-sw/2, -13, sw, 26, 13);

          this.statusTxt = this.add.text(0, 0, stLabel, {
            fontSize:"12px", color: this.statusColor(agent.status),
            fontFamily:"Inter, system-ui, sans-serif", fontStyle:"600",
          }).setOrigin(0.5);

          const statusBadge = this.add.container(0, 68, [this.statusBg, this.statusTxt]);

          const c = this.add.container(x, y, [
            shadowGfx, this.leftLegGfx, this.rightLegGfx,
            this.bodyGfx, nameBadge, statusBadge
          ]);
          c.setDepth(10);
          return c;
        }

        private refreshBadge(status: AgentStatus) {
          if (!this.statusTxt) return;
          const label = this.statusText(status);
          this.statusTxt.setText(label);
          this.statusTxt.setColor(this.statusColor(status));
          if (this.nameDot) this.nameDot.setFillStyle(this.statusHex(status));
          if (this.statusBg) {
            this.statusBg.clear();
            const sw = label.length * 8 + 28;
            this.statusBg.fillStyle(0x1e2438, 0.92);
            this.statusBg.fillRoundedRect(-sw/2, -13, sw, 26, 13);
          }
        }

        applyStatusEffect(status: AgentStatus) {
          if (this.bobTween) { this.bobTween.destroy(); this.bobTween = null; }
          this.agentC?.setAlpha(1);
          this.refreshBadge(status);

          switch (status) {
            case "idle":
              this.bobTween = this.tweens.add({
                targets: this.agentC, y: "-=4", duration: 2000,
                yoyo: true, repeat: -1, ease: "Sine.easeInOut",
              });
              if (!this.routineLocked) this.startWander();
              break;

            case "working":
              if (!this.routineLocked) {
                this.routineLocked = true;
                this.moveTo(this.deskPos.x, this.deskPos.y, 1600, () => {
                  this.playTyping();
                });
              }
              break;

            case "replying":
              this.stopTyping();
              this.tweens.add({
                targets: this.agentC, y: "-=12", duration: 160,
                yoyo: true, repeat: 3, ease: "Bounce.easeOut",
              });
              this.bobTween = this.tweens.add({
                targets: this.nameDot, alpha: 0.2, duration: 300,
                yoyo: true, repeat: -1,
              });
              break;

            case "error":
              this.stopTyping(); this.routineLocked = false;
              this.tweens.add({
                targets: this.agentC, x: "+=8", duration: 65,
                yoyo: true, repeat: 7, ease: "Linear",
              });
              this.bobTween = this.tweens.add({
                targets: this.agentC, alpha: 0.45, duration: 450,
                yoyo: true, repeat: -1,
              });
              break;
          }
        }

        updateStatus(status: AgentStatus) {
          if (status === this.currentStatus && !["working","replying","error"].includes(status)) return;
          if (["working","replying","error"].includes(status)) {
            this.routineLocked = false;
          }
          this.currentStatus = status;
          this.applyStatusEffect(status);
        }

        // Walking leg animation
        update(time: number) {
          if (!this.isWalking || this.isSitting) return;
          const phase = time * 0.007;
          if (this.leftLegGfx)  this.leftLegGfx.y  =  Math.sin(phase) * 9;
          if (this.rightLegGfx) this.rightLegGfx.y = -Math.sin(phase) * 9;
        }

        private moveTo(tx: number, ty: number, dur: number, onDone?: () => void) {
          this.setSitting(false);
          this.isWalking = true;
          this.tweens.add({
            targets: this.agentC, x: tx, y: ty, duration: dur,
            ease: "Sine.easeInOut",
            onComplete: () => {
              this.isWalking = false;
              if (this.leftLegGfx)  this.leftLegGfx.y  = 0;
              if (this.rightLegGfx) this.rightLegGfx.y = 0;
              if (onDone) onDone();
            },
          });
        }

        private startWander() {
          if (this.routineLocked || this.currentStatus !== "idle") return;
          const wp = Phaser.Utils.Array.GetRandom(this.wanderPts) as {x:number;y:number};
          this.moveTo(wp.x, wp.y, 2000, () => {
            if (!this.routineLocked && this.currentStatus === "idle") {
              this.time.delayedCall(1400, () => this.startWander());
            }
          });
        }

        private typingTween: Phaser.Tweens.Tween | null = null;
        private playTyping() {
          this.setSitting(true);
          this.typingTween = this.tweens.add({
            targets: this.agentC, y: "-=2", duration: 220,
            yoyo: true, repeat: -1, ease: "Sine.easeInOut",
          });
        }
        private stopTyping() {
          this.typingTween?.destroy();
          this.typingTween = null;
          this.setSitting(false);
        }

        private scheduleRoutine() {
          this.time.addEvent({ delay: WORK_INTERVAL, loop: true, callback: () => {
            if (this.currentStatus !== "error") this.doWorkAtDesk();
          }});
          this.time.addEvent({ delay: REST_INTERVAL, loop: true, callback: () => {
            if (this.currentStatus !== "error" && !this.routineLocked)
              this.doRestOnSofa();
          }});
        }

        private doWorkAtDesk() {
          this.routineLocked = true;
          this.currentStatus = "working";
          this.refreshBadge("working");
          this.moveTo(this.deskPos.x, this.deskPos.y, 1600, () => {
            this.playTyping();
            this.time.delayedCall(WORK_DURATION, () => {
              this.stopTyping();
              this.currentStatus = "idle";
              this.refreshBadge("idle");
              this.moveTo(this.centerPos.x, this.centerPos.y, 1400, () => {
                this.routineLocked = false;
                this.startWander();
              });
            });
          });
        }

        private doRestOnSofa() {
          this.routineLocked = true;
          this.moveTo(this.sofaPos.x, this.sofaPos.y, 1600, () => {
            this.setSitting(true);
            this.time.delayedCall(REST_DURATION, () => {
              this.setSitting(false);
              this.moveTo(this.centerPos.x, this.centerPos.y, 1400, () => {
                this.routineLocked = false;
                this.startWander();
              });
            });
          });
        }

        private statusText(s: AgentStatus): string {
          return { idle:"Idle", working:"Working", replying:"Replying", error:"Error" }[s];
        }
        private statusColor(s: AgentStatus): string {
          return { idle:"#9ca3af", working:"#fbbf24", replying:"#818cf8", error:"#f87171" }[s];
        }
        private statusHex(s: AgentStatus): number {
          return { idle:0x9ca3af, working:0x22c55e, replying:0x818cf8, error:0xf87171 }[s];
        }
        private avatarColor(style: string): number {
          return ({
            blue:0x3b82f6, purple:0xa855f7, green:0x10b981,
            amber:0xf59e0b, pink:0xec4899, cyan:0x06b6d4,
            red:0xef4444, indigo:0x6366f1,
          } as Record<string,number>)[style] ?? 0x26a996;
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current!,
        backgroundColor: "#1b2029",
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [OfficeScene],
        banner: false,
      });
    });

    return () => {
      mounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.updateStatus(agent.status);
  }, [agent.status]);

  return <div ref={containerRef} className="w-full h-full" />;
}

type OfficeScene = { updateStatus: (s: AgentStatus) => void };
