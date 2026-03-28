"use client";

import { useEffect, useRef } from "react";
import type { Agent, AgentStatus } from "@/lib/types";

interface Props {
  agent: Agent;
}

// Phaser is loaded client-side only (no SSR)
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
        private agentSprite!: Phaser.GameObjects.Container;
        private nameLabel!: Phaser.GameObjects.Text;
        private statusLabel!: Phaser.GameObjects.Text;
        private statusIndicator!: Phaser.GameObjects.Arc;
        private currentStatus: AgentStatus = agent.status;
        private bobTween: Phaser.Tweens.Tween | null = null;
        private shakeActive = false;

        constructor() {
          super({ key: "OfficeScene" });
        }

        preload() {
          // No external assets needed — we draw everything with graphics
        }

        create() {
          const W = this.scale.width;
          const H = this.scale.height;

          // ── Floor ──────────────────────────────────────────────────────────
          const floor = this.add.graphics();
          floor.fillStyle(0x1e2235, 1);
          floor.fillRect(0, 0, W, H);

          // Subtle grid
          const grid = this.add.graphics();
          grid.lineStyle(1, 0x2a2f4a, 0.4);
          for (let x = 0; x < W; x += 40) {
            grid.lineBetween(x, 0, x, H);
          }
          for (let y = 0; y < H; y += 40) {
            grid.lineBetween(0, y, W, y);
          }

          // ── Desk area (top-left zone) ─────────────────────────────────────
          this.drawDesk(80, 80);

          // ── Meeting sofa (top-right zone) ─────────────────────────────────
          this.drawSofa(W - 180, 80);

          // ── Computer monitor on desk ───────────────────────────────────────
          this.drawMonitor(100, 70);

          // ── Agent avatar ──────────────────────────────────────────────────
          const avatarColor = this.getAvatarColor(agent.avatar_style);
          this.agentSprite = this.createAvatar(
            agent.pos_x,
            agent.pos_y,
            avatarColor
          );

          // Name label
          this.nameLabel = this.add
            .text(agent.pos_x, agent.pos_y - 55, agent.name, {
              fontSize: "13px",
              color: "#f0f2f8",
              fontFamily: "Inter, system-ui, sans-serif",
              fontStyle: "600",
            })
            .setOrigin(0.5, 0.5);

          // Status label
          this.statusLabel = this.add
            .text(agent.pos_x, agent.pos_y - 38, this.statusText(agent.status), {
              fontSize: "11px",
              color: this.statusColor(agent.status),
              fontFamily: "Inter, system-ui, sans-serif",
            })
            .setOrigin(0.5, 0.5);

          // Status dot on avatar
          this.statusIndicator = this.add
            .circle(agent.pos_x + 16, agent.pos_y - 16, 6, this.statusHex(agent.status))
            .setDepth(10);

          this.applyStatusEffect(agent.status);

          sceneRef.current = this;
        }

        private drawDesk(x: number, y: number) {
          const g = this.add.graphics();
          // Desk surface
          g.fillStyle(0x2d3550, 1);
          g.fillRoundedRect(x, y, 160, 80, 8);
          // Desk legs
          g.fillStyle(0x1a2038, 1);
          g.fillRect(x + 10, y + 78, 12, 20);
          g.fillRect(x + 138, y + 78, 12, 20);
          // Keyboard
          g.fillStyle(0x3a4060, 1);
          g.fillRoundedRect(x + 20, y + 50, 80, 18, 4);
          // Mouse
          g.fillStyle(0x3a4060, 1);
          g.fillEllipse(x + 120, y + 58, 16, 20);
          // Desk pad
          g.fillStyle(0x252b42, 1);
          g.fillRoundedRect(x + 15, y + 40, 100, 35, 4);
        }

        private drawMonitor(x: number, y: number) {
          const g = this.add.graphics();
          // Monitor body
          g.fillStyle(0x1a1f35, 1);
          g.fillRoundedRect(x + 30, y, 100, 65, 6);
          // Screen (slightly glowing blue)
          g.fillStyle(0x1a3a6a, 1);
          g.fillRoundedRect(x + 36, y + 6, 88, 50, 4);
          // Screen glow effect via tint
          const screenGlow = this.add.graphics();
          screenGlow.fillStyle(0x4f6ef7, 0.08);
          screenGlow.fillRoundedRect(x + 36, y + 6, 88, 50, 4);
          // Code lines on screen
          const lines = this.add.graphics();
          lines.lineStyle(1.5, 0x4f6ef7, 0.6);
          for (let i = 0; i < 4; i++) {
            const w = 30 + Math.random() * 40;
            lines.lineBetween(x + 42, y + 16 + i * 10, x + 42 + w, y + 16 + i * 10);
          }
          // Stand
          g.fillStyle(0x1a1f35, 1);
          g.fillRect(x + 75, y + 65, 10, 12);
          g.fillRect(x + 60, y + 77, 40, 6);
        }

        private drawSofa(x: number, y: number) {
          const g = this.add.graphics();
          // Sofa body
          g.fillStyle(0x2a3050, 1);
          g.fillRoundedRect(x, y + 20, 140, 55, 10);
          // Sofa back
          g.fillStyle(0x333a5a, 1);
          g.fillRoundedRect(x, y, 140, 30, 8);
          // Armrests
          g.fillStyle(0x3a4268, 1);
          g.fillRoundedRect(x - 8, y + 20, 18, 45, 5);
          g.fillRoundedRect(x + 130, y + 20, 18, 45, 5);
          // Cushions
          g.fillStyle(0x2f3858, 1);
          g.fillRoundedRect(x + 10, y + 28, 50, 38, 6);
          g.fillRoundedRect(x + 72, y + 28, 50, 38, 6);
          // Coffee table
          g.fillStyle(0x24293f, 1);
          g.fillRoundedRect(x + 20, y + 90, 100, 8, 4);
          g.fillRect(x + 30, y + 98, 6, 14);
          g.fillRect(x + 104, y + 98, 6, 14);
        }

        private createAvatar(
          x: number,
          y: number,
          color: number
        ): Phaser.GameObjects.Container {
          const container = this.add.container(x, y);

          // Shadow
          const shadow = this.add.ellipse(0, 22, 36, 12, 0x000000, 0.3);

          // Body
          const body = this.add.graphics();
          body.fillStyle(color, 1);
          body.fillRoundedRect(-16, -8, 32, 30, 6);

          // Head
          const head = this.add.circle(0, -22, 16, color);

          // Face details
          const face = this.add.graphics();
          face.fillStyle(0xffffff, 0.9);
          face.fillCircle(-5, -24, 3); // left eye
          face.fillCircle(5, -24, 3); // right eye
          face.fillStyle(0x000000, 0.6);
          face.fillCircle(-5, -24, 1.5);
          face.fillCircle(5, -24, 1.5);
          // Smile
          face.lineStyle(1.5, 0x000000, 0.5);
          face.strokeEllipse(0, -17, 8, 4);

          // Collar
          const collar = this.add.graphics();
          collar.fillStyle(0xffffff, 0.3);
          collar.fillTriangle(-6, -8, 6, -8, 0, 2);

          container.add([shadow, body, head, face, collar]);
          container.setDepth(5);
          return container;
        }

        // ── Status effects ──────────────────────────────────────────────────

        applyStatusEffect(status: AgentStatus) {
          // Stop any existing tweens
          if (this.bobTween) {
            this.bobTween.destroy();
            this.bobTween = null;
          }
          this.agentSprite.setAlpha(1);
          this.agentSprite.setScale(1);

          // Update labels
          this.statusLabel.setText(this.statusText(status));
          this.statusLabel.setColor(this.statusColor(status));
          this.statusIndicator.setFillStyle(this.statusHex(status));

          switch (status) {
            case "idle":
              // Gentle breathing
              this.bobTween = this.tweens.add({
                targets: this.agentSprite,
                scaleY: 0.97,
                duration: 1800,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
              });
              break;

            case "working":
              // Bobbing up and down
              this.bobTween = this.tweens.add({
                targets: [this.agentSprite, this.nameLabel, this.statusLabel],
                y: "-=6",
                duration: 500,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
              });
              break;

            case "replying":
              // Quick bounce + pulse
              this.tweens.add({
                targets: this.agentSprite,
                scaleX: 1.08,
                scaleY: 0.95,
                duration: 150,
                yoyo: true,
                repeat: 2,
                ease: "Bounce.easeOut",
              });
              this.bobTween = this.tweens.add({
                targets: this.statusIndicator,
                alpha: 0.3,
                duration: 400,
                yoyo: true,
                repeat: -1,
              });
              break;

            case "error":
              // Shake
              this.tweens.add({
                targets: [this.agentSprite, this.nameLabel, this.statusLabel],
                x: `+=${6}`,
                duration: 80,
                yoyo: true,
                repeat: 5,
                ease: "Linear",
                onComplete: () => {
                  this.agentSprite.setAlpha(1);
                },
              });
              // Warning flash
              this.bobTween = this.tweens.add({
                targets: this.agentSprite,
                alpha: 0.5,
                duration: 600,
                yoyo: true,
                repeat: -1,
              });
              break;
          }
        }

        updateStatus(status: AgentStatus) {
          if (status === this.currentStatus) return;
          this.currentStatus = status;
          this.applyStatusEffect(status);
        }

        private statusText(s: AgentStatus): string {
          return { idle: "● Idle", working: "⚙ Working", replying: "💬 Replying", error: "⚠ Error" }[s];
        }

        private statusColor(s: AgentStatus): string {
          return { idle: "#9ca3af", working: "#fbbf24", replying: "#4f6ef7", error: "#f87171" }[s];
        }

        private statusHex(s: AgentStatus): number {
          return { idle: 0x9ca3af, working: 0xfbbf24, replying: 0x4f6ef7, error: 0xf87171 }[s];
        }

        private getAvatarColor(style: string): number {
          const colors: Record<string, number> = {
            blue: 0x3b82f6,
            purple: 0xa855f7,
            green: 0x10b981,
            amber: 0xf59e0b,
            pink: 0xec4899,
            cyan: 0x06b6d4,
            red: 0xef4444,
            indigo: 0x6366f1,
          };
          return colors[style] ?? 0x4f6ef7;
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
        // Disable default banner
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
  }, []); // Run once on mount

  // When agent status changes externally, tell the scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene && agent.status) {
      scene.updateStatus(agent.status);
    }
  }, [agent.status]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: "default" }}
    />
  );
}

// Type alias used inside the effect to satisfy TypeScript
type OfficeScene = {
  updateStatus: (status: AgentStatus) => void;
};
