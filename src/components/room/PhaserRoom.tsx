"use client";

import { useEffect, useRef } from "react";
import type { Agent, AgentStatus } from "@/lib/types";

interface Props {
  agent: Agent;
}

export function PhaserRoom({ agent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

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
        private isMoving = false;

        // Walk waypoints around the office
        private waypoints: { x: number; y: number }[] = [];

        constructor() {
          super({ key: "OfficeScene" });
        }

        preload() {}

        create() {
          const W = this.scale.width;
          const H = this.scale.height;

          // ── Floor
          const floor = this.add.graphics();
          floor.fillStyle(0x1a1f35, 1);
          floor.fillRect(0, 0, W, H);

          // Grid
          const grid = this.add.graphics();
          grid.lineStyle(1, 0x2a2f4a, 0.35);
          for (let x = 0; x < W; x += 48) grid.lineBetween(x, 0, x, H);
          for (let y = 0; y < H; y += 48) grid.lineBetween(0, y, W, y);

          // ── Furniture
          this.drawDesk(70, 70);
          this.drawMonitor(90, 60);
          this.drawSofa(W - 190, 70);

          // ── Waypoints for walking
          this.waypoints = [
            { x: W * 0.35, y: H * 0.45 },
            { x: W * 0.55, y: H * 0.35 },
            { x: W * 0.65, y: H * 0.6 },
            { x: W * 0.4, y: H * 0.65 },
            { x: W * 0.25, y: H * 0.5 },
          ];

          // ── Agent avatar
          const color = this.avatarColor(agent.avatar_style);
          this.agentContainer = this.buildAvatar(
            agent.pos_x, agent.pos_y, color
          );

          // Labels (outside the container so they sit above)
          this.nameLabel = this.add
            .text(agent.pos_x, agent.pos_y - 56, agent.name, {
              fontSize: "13px", color: "#f0f2f8",
              fontFamily: "Inter, system-ui, sans-serif",
              fontStyle: "600",
            })
            .setOrigin(0.5).setDepth(10);

          this.statusLabel = this.add
            .text(agent.pos_x, agent.pos_y - 40,
              this.statusText(agent.status), {
              fontSize: "11px",
              color: this.statusColor(agent.status),
              fontFamily: "Inter, system-ui, sans-serif",
            })
            .setOrigin(0.5).setDepth(10);

          this.statusDot = this.add
            .circle(agent.pos_x + 18, agent.pos_y - 18, 6,
              this.statusHex(agent.status))
            .setDepth(11);

          this.applyStatusEffect(agent.status);

          sceneRef.current = this;
        }

        // ── Walk to a position then call onDone
        private walkTo(
          x: number, y: number,
          duration: number,
          onDone?: () => void
        ) {
          this.isMoving = true;
          const flip = x < this.agentContainer.x;
          this.agentContainer.setScale(flip ? -1 : 1, 1);

          this.tweens.add({
            targets: [
              this.agentContainer,
              this.nameLabel,
              this.statusLabel,
              this.statusDot,
            ],
            x,
            duration,
            ease: "Sine.easeInOut",
            onUpdate: () => {
              // Leg-swing bob while walking
              this.agentContainer.y = y +
                Math.sin(Date.now() / 120) * 5;
              this.nameLabel.y =
                this.agentContainer.y - 56;
              this.statusLabel.y =
                this.agentContainer.y - 40;
              this.statusDot.y =
                this.agentContainer.y - 18;
              this.statusDot.x =
                this.agentContainer.x + (flip ? -18 : 18);
            },
            onComplete: () => {
              this.isMoving = false;
              if (onDone) onDone();
            },
          });
        }

        // ── Walk to a random waypoint (loops while working)
        private startWalking() {
          if (this.currentStatus !== "working") return;
          const wp = Phaser.Utils.Array.GetRandom(this.waypoints) as
            { x: number; y: number };
          this.walkTo(wp.x, wp.y, 1800, () => {
            if (this.currentStatus === "working") {
              this.time.delayedCall(600, () => this.startWalking());
            }
          });
        }

        // ── Status effects
        applyStatusEffect(status: AgentStatus) {
          if (this.bobTween) {
            this.bobTween.destroy();
            this.bobTween = null;
          }
          this.agentContainer.setAlpha(1).setScale(1);
          this.statusLabel.setText(this.statusText(status));
          this.statusLabel.setColor(this.statusColor(status));
          this.statusDot.setFillStyle(this.statusHex(status));

          switch (status) {
            case "idle":
              // Gentle breathing
              this.bobTween = this.tweens.add({
                targets: this.agentContainer,
                scaleY: 0.96, duration: 1800,
                yoyo: true, repeat: -1,
                ease: "Sine.easeInOut",
              });
              break;

            case "working":
              // Walk around the office
              this.startWalking();
              break;

            case "replying":
              // Quick excited bounce
              this.tweens.add({
                targets: this.agentContainer,
                y: `-=12`, duration: 200,
                yoyo: true, repeat: 3,
                ease: "Sine.easeOut",
              });
              this.bobTween = this.tweens.add({
                targets: this.statusDot,
                alpha: 0.2, duration: 350,
                yoyo: true, repeat: -1,
              });
              break;

            case "error":
              // Shake left-right
              this.tweens.add({
                targets: [
                  this.agentContainer,
                  this.nameLabel,
                  this.statusLabel,
                ],
                x: `+=8`, duration: 70,
                yoyo: true, repeat: 6,
                ease: "Linear",
              });
              this.bobTween = this.tweens.add({
                targets: this.agentContainer,
                alpha: 0.4, duration: 500,
                yoyo: true, repeat: -1,
              });
              break;
          }
        }

        updateStatus(status: AgentStatus) {
          if (status === this.currentStatus) return;
          this.currentStatus = status;
          this.applyStatusEffect(status);
        }

        // ── Helpers
        private buildAvatar(
          x: number, y: number, color: number
        ): Phaser.GameObjects.Container {
          const c = this.add.container(x, y).setDepth(5);

          // Shadow
          c.add(this.add.ellipse(0, 24, 38, 12, 0x000000, 0.25));

          // Body
          const body = this.add.graphics();
          body.fillStyle(color, 1);
          body.fillRoundedRect(-15, -6, 30, 30, 6);
          c.add(body);

          // Legs (two small rects that animate)
          const legs = this.add.graphics();
          legs.fillStyle(Phaser.Display.Color.ValueToColor(color)
            .darken(20).color, 1);
          legs.fillRect(-9, 22, 8, 10);
          legs.fillRect(3, 22, 8, 10);
          c.add(legs);

          // Head
          c.add(this.add.circle(0, -22, 16, color));

          // Eyes
          const face = this.add.graphics();
          face.fillStyle(0xffffff, 0.95);
          face.fillCircle(-5, -24, 3.5);
          face.fillCircle(5, -24, 3.5);
          face.fillStyle(0x1a1f35, 1);
          face.fillCircle(-4.5, -24, 1.8);
          face.fillCircle(5.5, -24, 1.8);
          // Smile
          face.lineStyle(1.5, 0x1a1f35, 0.5);
          face.strokeEllipse(0, -16, 10, 5);
          c.add(face);

          return c;
        }

        private drawDesk(x: number, y: number) {
          const g = this.add.graphics();
          g.fillStyle(0x2d3550, 1);
          g.fillRoundedRect(x, y, 165, 82, 8);
          g.fillStyle(0x1a2038, 1);
          g.fillRect(x + 10, y + 80, 14, 18);
          g.fillRect(x + 141, y + 80, 14, 18);
          g.fillStyle(0x252b42, 1);
          g.fillRoundedRect(x + 14, y + 42, 106, 32, 4);
          g.fillStyle(0x3a4060, 1);
          g.fillRoundedRect(x + 18, y + 52, 82, 16, 3);
          g.fillEllipse(x + 118, y + 58, 16, 20);
        }

        private drawMonitor(x: number, y: number) {
          const g = this.add.graphics();
          g.fillStyle(0x181d32, 1);
          g.fillRoundedRect(x + 28, y, 106, 66, 6);
          g.fillStyle(0x1a3a6a, 1);
          g.fillRoundedRect(x + 34, y + 6, 94, 52, 4);
          // Glow
          const glow = this.add.graphics();
          glow.fillStyle(0x4f6ef7, 0.07);
          glow.fillRoundedRect(x + 34, y + 6, 94, 52, 4);
          // Code lines
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
          g.fillStyle(0x333a5a, 1);
          g.fillRoundedRect(x, y, 145, 28, 8);
          g.fillStyle(0x2a3050, 1);
          g.fillRoundedRect(x, y + 22, 145, 52, 10);
          g.fillStyle(0x3a4268, 1);
          g.fillRoundedRect(x - 8, y + 22, 18, 44, 5);
          g.fillRoundedRect(x + 135, y + 22, 18, 44, 5);
          g.fillStyle(0x2f3858, 1);
          g.fillRoundedRect(x + 10, y + 28, 52, 36, 6);
          g.fillRoundedRect(x + 74, y + 28, 52, 36, 6);
          // Table
          g.fillStyle(0x20253c, 1);
          g.fillRoundedRect(x + 18, y + 88, 108, 8, 4);
          g.fillRect(x + 28, y + 96, 6, 14);
          g.fillRect(x + 108, y + 96, 6, 14);
        }

        private statusText(s: AgentStatus): string {
          return {
            idle: "● Idle",
            working: "⚡ Working",
            replying: "💬 Replying",
            error: "⚠ Error",
          }[s];
        }

        private statusColor(s: AgentStatus): string {
          return {
            idle: "#9ca3af",
            working: "#fbbf24",
            replying: "#4f6ef7",
            error: "#f87171",
          }[s];
        }

        private statusHex(s: AgentStatus): number {
          return {
            idle: 0x9ca3af,
            working: 0xfbbf24,
            replying: 0x4f6ef7,
            error: 0xf87171,
          }[s];
        }

        private avatarColor(style: string): number {
          return ({
            blue: 0x3b82f6, purple: 0xa855f7, green: 0x10b981,
            amber: 0xf59e0b, pink: 0xec4899, cyan: 0x06b6d4,
            red: 0xef4444, indigo: 0x6366f1,
          } as Record<string, number>)[style] ?? 0x4f6ef7;
        }
      }

      const config: import("phaser").Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: "#0d0f1e",
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [OfficeScene],
        banner: false,
      };

      gameRef.current = new Phaser.Game(config);
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

type OfficeScene = {
  updateStatus: (status: AgentStatus) => void;
};
