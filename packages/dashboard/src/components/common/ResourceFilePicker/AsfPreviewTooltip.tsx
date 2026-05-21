/**
 * ASF 预览 Tooltip
 * 鼠标悬停时显示 ASF 动画预览
 */

import type { AsfData } from "@miu2d/engine/resource/format/asf";
import { getCompositeFrameCanvas } from "@miu2d/engine/resource/format/asf";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasm-asf-decoder";
import { initWasm } from "@miu2d/engine/wasm/wasm-manager";
import { useEffect, useRef, useState } from "react";
import { buildResourceUrl } from "../../../utils";

interface AsfPreviewTooltipProps {
  /** 游戏 slug */
  gameSlug: string;
  /** ASF 文件路径 */
  path: string;
  /** 定位（相对于触发元素） */
  position?: { x: number; y: number };
  /** 关闭回调 */
  onClose?: () => void;
}

export function AsfPreviewTooltip({ gameSlug, path, position, onClose }: AsfPreviewTooltipProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [asf, setAsf] = useState<AsfData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // 加载 ASF
  useEffect(() => {
    let cancelled = false;

    const loadAsf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 初始化 WASM
        await initWasm();

        // 加载文件（路径转小写，.asf → .msf）
        const url = buildResourceUrl(gameSlug, path.toLowerCase());
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const asfData = decodeAsfWasm(buffer);

        if (!asfData) {
          throw new Error("ASF 解码失败");
        }

        if (!cancelled) {
          setAsf(asfData);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAsf();

    return () => {
      cancelled = true;
    };
  }, [gameSlug, path]);

  // 动画循环
  useEffect(() => {
    if (!asf) return;

    const framesPerDirection = asf.framesPerDirection;
    const interval = asf.interval || 100;

    const animate = (time: number) => {
      if (time - lastTimeRef.current >= interval) {
        setCurrentFrame((prev) => (prev + 1) % framesPerDirection);
        lastTimeRef.current = time;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [asf]);

  // 绘制帧
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !asf || asf.frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frameIndex = currentFrame;
    if (frameIndex >= asf.frames.length) return;

    const frameCanvas = getCompositeFrameCanvas(asf, frameIndex);

    // 限制最大尺寸
    const maxSize = 128;
    const scale = Math.min(1, maxSize / Math.max(asf.width, asf.height));
    const displayWidth = Math.floor(asf.width * scale);
    const displayHeight = Math.floor(asf.height * scale);

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // 棋盘格背景
    const gridSize = 8;
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = "#2d2d2d";
    for (let x = 0; x < displayWidth; x += gridSize * 2) {
      for (let y = 0; y < displayHeight; y += gridSize * 2) {
        ctx.fillRect(x, y, gridSize, gridSize);
        ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);
      }
    }

    // 绘制帧
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frameCanvas, 0, 0, displayWidth, displayHeight);
  }, [asf, currentFrame]);

  // 计算位置
  const style: React.CSSProperties = position
    ? {
        position: "fixed",
        left: position.x + 16,
        top: position.y,
        zIndex: 9999,
      }
    : {};

  if (isLoading) {
    return (
      <div style={style} className="bg-[#252526] border border-[#454545] rounded shadow-lg p-3">
        <div className="flex items-center gap-2 text-[#808080] text-sm">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={style} className="bg-[#252526] border border-[#454545] rounded shadow-lg p-3">
        <div className="text-red-400 text-sm">
          <span>❌ {error}</span>
        </div>
      </div>
    );
  }

  if (!asf) return null;

  return (
    <div
      style={style}
      className="bg-[#252526] border border-[#454545] rounded shadow-lg overflow-hidden"
      onMouseLeave={onClose}
    >
      <canvas ref={canvasRef} style={{ imageRendering: "pixelated" }} />
      <div className="px-2 py-1 text-xs text-[#808080] border-t border-[#454545] bg-[#1e1e1e]">
        {asf.width}×{asf.height} · {asf.frameCount}帧 · {asf.directions}方向
      </div>
    </div>
  );
}

// ========== Mini ASF Preview (内嵌预览) ==========

interface MiniAsfPreviewProps {
  /** 游戏 slug */
  gameSlug: string;
  /** ASF 文件路径（支持单路径或多路径数组，多路径时会依次尝试） */
  path: string | string[];
  /** 预览尺寸 */
  size?: number;
  /** 当找到正确路径时的回调 */
  onPathResolved?: (resolvedPath: string) => void;
}

export function MiniAsfPreview({ gameSlug, path, size = 48, onPathResolved }: MiniAsfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [asf, setAsf] = useState<AsfData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const onPathResolvedRef = useRef(onPathResolved);
  onPathResolvedRef.current = onPathResolved;

  // 用字符串 key 稳定路径依赖，避免数组引用变化导致无限刷新
  const pathKey = Array.isArray(path) ? path.join("\0") : path;

  // IntersectionObserver 懒加载：进入视口后才开始加载 ASF
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 加载 ASF（支持多路径尝试）— 仅在可见后触发
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    const paths = pathKey.split("\0");

    const loadAsf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await initWasm();

        // 依次尝试每个路径
        let lastError: Error | null = null;
        for (const p of paths) {
          if (cancelled) return;

          const url = buildResourceUrl(gameSlug, p.toLowerCase());
          try {
            const response = await fetch(url);
            if (!response.ok) {
              lastError = new Error(`HTTP ${response.status}`);
              continue; // 尝试下一个路径
            }

            const buffer = await response.arrayBuffer();
            const asfData = decodeAsfWasm(buffer);
            if (!asfData) {
              lastError = new Error("解码失败");
              continue;
            }

            if (!cancelled) {
              setAsf(asfData);
              // 通知父组件实际使用的路径
              onPathResolvedRef.current?.(p);
            }
            return; // 成功，退出
          } catch (e) {
            lastError = e as Error;
          }
        }

        // 所有路径都失败
        if (!cancelled && lastError) {
          setError(lastError.message);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (paths.length > 0 && paths[0]) loadAsf();

    return () => {
      cancelled = true;
    };
  }, [isVisible, gameSlug, pathKey]);

  // 动画循环
  useEffect(() => {
    if (!asf) return;

    const framesPerDirection = asf.framesPerDirection;
    const interval = asf.interval || 100;

    const animate = (time: number) => {
      if (time - lastTimeRef.current >= interval) {
        setCurrentFrame((prev) => (prev + 1) % framesPerDirection);
        lastTimeRef.current = time;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [asf]);

  // 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !asf || asf.frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frameIndex = currentFrame % asf.frames.length;
    const frameCanvas = getCompositeFrameCanvas(asf, frameIndex);

    canvas.width = size;
    canvas.height = size;

    // 棋盘格背景
    const gridSize = 8;
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#2d2d2d";
    for (let x = 0; x < size; x += gridSize * 2) {
      for (let y = 0; y < size; y += gridSize * 2) {
        ctx.fillRect(x, y, gridSize, gridSize);
        ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);
      }
    }

    // 缩放绘制
    const scale = Math.min(size / asf.width, size / asf.height);
    const w = asf.width * scale;
    const h = asf.height * scale;
    const x = (size - w) / 2;
    const y = (size - h) / 2;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frameCanvas, x, y, w, h);
  }, [asf, currentFrame, size]);

  // 未进入视口时显示占位符
  if (!isVisible) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center bg-[#2d2d2d] rounded"
        style={{ width: size, height: size }}
      >
        <span className="text-[#555] text-[10px]">...</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center bg-[#2d2d2d] rounded"
        style={{ width: size, height: size }}
      >
        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !asf) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center bg-[#2d2d2d] rounded text-[#808080]"
        style={{ width: size, height: size }}
        title={error || "无法加载"}
      >
        🎬
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="rounded border border-[#454545]"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}
