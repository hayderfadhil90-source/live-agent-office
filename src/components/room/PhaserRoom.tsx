"use client";

import { useEffect, useRef } from "react";
import type { Agent, AgentStatus } from "@/lib/types";

interface Props {
  agent: Agent;
}

// Timing (ms)
const WORK_INTERVAL    = 60 * 60 * 1000;  // every 1 hour  → go to desk
const REST_INTERVAL    = 20 * 60 * 1000;  // every 20 min  → rest on sofa
const WORK_DURATION    = 5  * 60 * 1000;  // work at desk for 5 min then resume wandering
const REST_DURATION    = 3  * 60 * 1000;  // rest on sofa for 3 min then resume

export function PhaserRoom({ agent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<import("phaser").Game | null>(null);
  const sceneRef     = useRef<OfficeScene | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    let mounted = true;

    import("phaser").then((Phaser) => {
      if (!mounted || !containerRef.current) return;

      class OfficeScene extends Phaser.Scene {
        private agentContainer!: Phaser.GameObjects.Container;
        private nameLabel!: Phaser.GameObjects.Text;
        private statusLabel!: Phaser.GameObjects.Text;
        private statusDot!: Phaser.GameObjects.Arc;
        private currentStatus: AgentStatus = agent.status;
        private bobTween: Phaser.Tweens.Tween | null = null;
        private routineLocked = false; // prevents wander from interrupting routine

        // Positions defined after create() when W/H are known
        private deskPos!:  { x: number; y: number };
        private sofaPos!:  { x: number; y: number };
        private centerPos!:{ x: number; y: number };
        private wanderPts!: { x: number; y: number }[];

        constructor() { super({ key: "OfficeScene" }); }
        preload() {}

        create() {
          const W = this.scale.width;
          const H = this.scale.height;

          // ── Key positions
          this.deskPos   = { x: 210,       y: 155 };
          this.sofaPos   = { x: W - 115,   y: 175 };
          this.centerPos = { x: W * 0.45,  y: H * 0.5 };
          this.wanderPts = [
            { x: W * 0.3,  y: H * 0.45 },
            { x: W * 0.55, y: H * 0.38 },
            { x: W * 0.65, y: H * 0.62 },
            { x: W * 0.4,  y: H * 0.68 },
            { x: W * 0.25, y: H * 0.55 },
          ];

          // ── Background
          this.add.graphics()
            .fillStyle(0x1a1f35, 1)
            .fillRect(0, 0, W, H);

          const grid = this.add.graphics();
          grid.lineStyle(1, 0x2a2f4a, 0.35);
          for (let x = 0; x < W; x += 48) grid.lineBetween(x, 0, x, H);
          for (let y = 0; y < H; y += 48) grid.lineBetween(0, y, W, y);

          // ── Furniture
          this.drawDesk(70, 70);
          this.drawMonitor(90, 60);
          this.drawSofa(W - 190, 70);

          // ── Agent
          const color = this.avatarColor(agent.avatar_style);
          this.agentContainer = this.buildAvatar(agent.pos_x, agent.pos_y, color);

          this.nameLabel = this.add
            .text(agent.pos_x, agent.pos_y - 56, agent.name, {
              fontSize: "13px", color: "#f0f2f8",
              fontFamily: "Inter, system-ui, sans-serif", fontStyle: "600",
            }).setOrigin(0.5).setDepth(10);

          this.statusLabel = this.add
            .text(agent.pos_x, agent.pos_y - 40, this.statusText(agent.status), {
              fontSize: "11px", color: this.statusColor(agent.status),
              fontFamily: "Inter, system-ui, sans-serif",
            }).setOrigin(0.5).setDepth(10);

          this.statusDot = this.add
            .circle(agent.pos_x + 18, agent.pos_y - 18, 6, this.statusHex(agent.status))
            .setDepth(11);

          this.applyStatusEffect(agent.status);

          // ── Automatic daily routine
          this.scheduleRoutine();

          sceneRef.current = this;
        }

        // ───────────────────────────────────────────────
        // Routine scheduler
        // ───────────────────────────────────────────────
        private scheduleRoutine() {
          // Every hour → go work at desk
          this.time.addEvent({
            delay: WORK_INTERVAL,
            loop: true,
            callback: () => {
              if (this.currentStatus === "error") return;
              this.doWorkAtDesk();
            },
          });

          // Every 20 min → rest on sofa
          this.time.addEvent({
            delay: REST_INTERVAL,
            loop: true,
            callback: () => {
              if (this.currentStatus === "error") return;
              // Don't interrupt a desk session
              if (!this.routineLocked) this.doRestOnSofa();
            },
          });
        }

        // Walk to desk → type → return
        private doWorkAtDesk() {
          this.routineLocked = true;
          this.setInternalStatus("working");
          this.walkTo(this.deskPos.x, this.deskPos.y, 1600, () => {
            this.playTyping();
            // After WORK_DURATION, return to center and resume
            this.time.delayedCall(WORK_DURATION, () => {
              this.stopTyping();
              this.setInternalStatus("idle");
              this.walkTo(this.centerPos.x, this.centerPos.y, 1400, () => {
                this.routineLocked = false;
                if (this.currentStatus === "idle") this.startWander();
              });
            });
          });
        }

        // Walk to sofa → sit → return
        private doRestOnSofa() {
          this.routineLocked = true;
          this.setInternalStatus("idle");
          this.walkTo(this.sofaPos.x, this.sofaPos.y, 1600, () => {
            this.playSit();
            this.time.delayedCall(REST_DURATION, () => {
              this.stopSit();
              this.walkTo(this.centerPos.x, this.centerPos.y, 1400, () => {
                this.routineLocked = false;
                if (this.currentStatus === "idle") this.startWander();
              });
            });
          });
        }

        // ── Typing animation at desk
        private typingTween: Phaser.Tweens.Tween | null = null;
        private playTyping() {
          this.typingTween = this.tweens.add({
            targets: this.agentContainer,
            y: `-=4`, duration: 200,
            yoyo: true, repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
        private stopTyping() {
          this.typingTween?.destroy();
          this.typingTween = null;
        }

        // ── Sitting animation on sofa
        private sitTween: Phaser.Tweens.Tween | null = null;
        private playSit() {
          // Scale down slightly to look "seated"
          this.agentContainer.setScale(1, 0.75);
          this.sitTween = this.tweens.add({
            targets: this.agentContainer,
            scaleY: 0.72, duration: 2000,
            yoyo: true, repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
        private stopSit() {
          this.sitTween?.destroy();
          this.sitTween = null;
          this.agentContainer.setScale(1, 1);
        }

        // ───────────────────────────────────────────────
        // Walking
        // ───────────────────────────────────────────────
        private walkTo(
          x: number, y: number, duration: number, onDone?: () => void
        ) {
          const flip = x < this.agentContainer.x;
          this.agentContainer.setScale(flip ? -1 : 1, 1);

          this.tweens.add({
            targets: [
              this.agentContainer, this.nameLabel,
              this.statusLabel,    this.statusDot,
            ],
            x,
            duration,
            ease: "Sine.easeInOut",
            onUpdate: () => {
              const bobY = y + Math.sin(Date.now() / 110) * 5;
              this.agentContainer.y = bobY;
              this.nameLabel.y      = bobY - 56;
              this.statusLabel.y    = bobY - 40;
              this.statusDot.y      = bobY - 18;
              this.statusDot.x      = this.agentContainer.x + (flip ? -18 : 18);
            },
            onComplete: () => { if (onDone) onDone(); },
          });
        }

        private startWander() {
          if (this.routineLocked || this.currentStatus !== "idle") return;
          const wp = Phaser.Utils.Array.GetRandom(this.wanderPts) as { x: number; y: number };
          this.walkTo(wp.x, wp.y, 2200, () => {
            if (!this.routineLocked && this.currentStatus === "idle") {
              this.time.delayedCall(1500, () => this.startWander());
            }
          });
        }

        // ───────────────────────────────────────────────
        // Status effects (triggered by webhook)
        // ───────────────────────────────────────────────
        private setInternalStatus(s: AgentStatus) {
          this.statusLabel.setText(this.statusText(s));
          this.statusLabel.setColor(this.statusColor(s));
          this.statusDot.setFillStyle(this.statusHex(s));
        }

        applyStatusEffect(status: AgentStatus) {
          if (this.bobTween) { this.bobTween.destroy(); this.bobTween = null; }
          this.agentContainer.setAlpha(1);
          this.setInternalStatus(status);

          switch (status) {
            case "idle":
              this.bobTween = this.tweens.add({
                targets: this.agentContainer, scaleY: 0.96, duration: 1800,
                yoyo: true, repeat: -1, ease: "Sine.easeInOut",
              });
              if (!this.routineLocked) this.startWander();
              break;

            case "working":
              if (!this.routineLocked) {
                this.routineLocked = true;
                this.walkTo(this.deskPos.x, this.deskPos.y, 1600, () => {
                  this.playTyping();
                });
              }
              break;

            case "replying":
              this.stopTyping();
              this.tweens.add({
                targets: this.agentContainer, y: `-=12`, duration: 200,
                yoyo: true, repeat: 3, ease: "Sine.easeOut",
              });
              this.bobTween = this.tweens.add({
                targets: this.statusDot, alpha: 0.2, duration: 350,
                yoyo: true, repeat: -1,
              });
              break;

            case "error":
              this.stopTyping(); this.routineLocked = false;
              this.tweens.add({
                targets: [this.agentContainer, this.nameLabel, this.statusLabel],
                x: `+=8`, duration: 70, yoyo: true, repeat: 6, ease: "Linear",
              });
              this.bobTween = this.tweens.add({
                targets: this.agentContainer, alpha: 0.4, duration: 500,
                yoyo: true, repeat: -1,
              });
              break;
          }
        }

        updateStatus(status: AgentStatus) {
          if (status === this.currentStatus) return;
          // Webhook events override the routine
          if (status === "working" || status === "replying" || status === "error") {
            this.routineLocked = false;
          }
          this.currentStatus = status;
          this.applyStatusEffect(status);
        }

        // ───────────────────────────────────────────────
        // Drawing helpers
        // ───────────────────────────────────────────────
        private buildAvatar(x: number, y: number, color: number) {
          const c = this.add.container(x, y).setDepth(5);
          c.add(this.add.ellipse(0, 24, 38, 12, 0x000000, 0.25));
          const body = this.add.graphics();
          body.fillStyle(color, 1);
          body.fillRoundedRect(-15, -6, 30, 30, 6);
          c.add(body);
          const legs = this.add.graphics();
          legs.fillStyle(
            Phaser.Display.Color.ValueToColor(color).darken(20).color, 1
          );
          legs.fillRect(-9, 22, 8, 10);
          legs.fillRect(3, 22, 8, 10);
          c.add(legs);
          c.add(this.add.circle(0, -22, 16, color));
          const face = this.add.graphics();
          face.fillStyle(0xffffff, 0.95);
          face.fillCircle(-5, -24, 3.5); face.fillCircle(5, -24, 3.5);
          face.fillStyle(0x1a1f35, 1);
          face.fillCircle(-4.5, -24, 1.8); face.fillCircle(5.5, -24, 1.8);
          face.lineStyle(1.5, 0x1a1f35, 0.5);
          face.strokeEllipse(0, -16, 10, 5);
          c.add(face);
          return c;
        }

        private drawDesk(x: number, y: number) {
          const g = this.add.graphics();
          g.fillStyle(0x2d3550, 1).fillRoundedRect(x, y, 165, 82, 8);
          g.fillStyle(0x1a2038, 1);
          g.fillRect(x + 10, y + 80, 14, 18);
          g.fillRect(x + 141, y + 80, 14, 18);
          g.fillStyle(0x252b42, 1).fillRoundedRect(x + 14, y + 42, 106, 32, 4);
          g.fillStyle(0x3a4060, 1).fillRoundedRect(x + 18, y + 52, 82, 16, 3);
          g.fillEllipse(x + 118, y + 58, 16, 20);
        }

        private drawMonitor(x: number, y: number) {
          const g = this.add.graphics();
          g.fillStyle(0x181d32, 1).fillRoundedRect(x + 28, y, 106, 66, 6);
          g.fillStyle(0x1a3a6a, 1).fillRoundedRect(x + 34, y + 6, 94, 52, 4);
          const glow = this.add.graphics();
          glow.fillStyle(0x4f6ef7, 0.07).fillRoundedRect(x + 34, y + 6, 94, 52, 4);
          const lines = this.add.graphics();
          lines.lineStyle(1.5, 0x4f6ef7, 0.55);
          [0,1,2,3].forEach(i => {
            const w = 28 + (i % 3) * 14;
            lines.lineBetween(x+40, y+16+i*11, x+40+w, y+16+i*11);
          });
          g.fillStyle(0x181d32, 1);
          g.fillRect(x + 76, y + 66, 10, 12);
          g.fillRoundedRect(x + 58, y + 78, 46, 6, 3);
        }

        private drawSofa(x: number, y: number) {
          const g = this.add.graphics();
          g.fillStyle(0x333a5a, 1).fillRoundedRect(x, y, 145, 28, 8);
          g.fillStyle(0x2a3050, 1).fillRoundedRect(x, y + 22, 145, 52, 10);
          g.fillStyle(0x3a4268, 1);
          g.fillRoundedRect(x - 8, y + 22, 18, 44, 5);
          g.fillRoundedRect(x + 135, y + 22, 18, 44, 5);
          g.fillStyle(0x2f3858, 1);
          g.fillRoundedRect(x + 10, y + 28, 52, 36, 6);
          g.fillRoundedRect(x + 74, y + 28, 52, 36, 6);
          g.fillStyle(0x20253c, 1).fillRoundedRect(x + 18, y + 88, 108, 8, 4);
          g.fillRect(x + 28, y + 96, 6, 14);
          g.fillRect(x + 108, y + 96, 6, 14);
        }

        private statusText(s: AgentStatus): string {
          return { idle:"● Idle", working:"⚡ Working", replying:"💬 Replying", error:"⚠ Error" }[s];
        }
        private statusColor(s: AgentStatus): string {
          return { idle:"#9ca3af", working:"#fbbf24", replying:"#4f6ef7", error:"#f87171" }[s];
        }
        private statusHex(s: AgentStatus): number {
          return { idle:0x9ca3af, working:0xfbbf24, replying:0x4f6ef7, error:0xf87171 }[s];
        }
        private avatarColor(style: string): number {
          return ({
            blue:0x3b82f6, purple:0xa855f7, green:0x10b981,
            amber:0xf59e0b, pink:0xec4899, cyan:0x06b6d4,
            red:0xef4444, indigo:0x6366f1,
          } as Record<string,number>)[style] ?? 0x4f6ef7;
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current!,
        backgroundColor: "#0d0f1e",
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
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
