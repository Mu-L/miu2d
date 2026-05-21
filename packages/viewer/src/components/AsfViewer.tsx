/**
 * ASF 预览组件
 * 显示 ASF 动画帧和播放控制
 */

import type { AsfData } from "@miu2d/engine/resource/format/asf";
import { getCompositeFrameCanvas } from "@miu2d/engine/resource/format/asf";
import { useCallback, useEffect, useRef, useState } from "react";

interface AsfViewerProps {
  /** ASF 数据 */
  asf: AsfData | null;
  /** 文件名 */
  fileName?: string;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
}

export function AsfViewer({ asf, fileName, isLoading, error }: AsfViewerProps) {
  // 播放状态
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [currentDirection, setCurrentDirection] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zoom, setZoom] = useState(2);
  const [showGrid, setShowGrid] = useState(true);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // 计算当前方向的帧范围
  const framesPerDirection = asf?.framesPerDirection ?? 0;
  const startFrame = currentDirection * framesPerDirection;
  const _endFrame = startFrame + framesPerDirection;

  // 动画循环
  useEffect(() => {
    if (!asf || !isPlaying || framesPerDirection === 0) return;

    const interval = (asf.interval || 100) / playbackSpeed;

    const animate = (time: number) => {
      if (time - lastTimeRef.current >= interval) {
        setCurrentFrame((prev) => {
          const next = prev + 1;
          return next >= framesPerDirection ? 0 : next;
        });
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
  }, [asf, isPlaying, playbackSpeed, framesPerDirection]);

  // 绘制帧
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !asf || asf.frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frameIndex = startFrame + currentFrame;
    if (frameIndex >= asf.frames.length) return;

    const frameCanvas = getCompositeFrameCanvas(asf, frameIndex);

    // 设置 canvas 大小
    const displayWidth = asf.width * zoom;
    const displayHeight = asf.height * zoom;
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // 清除画布
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // 绘制网格背景
    if (showGrid) {
      const gridSize = 16 * zoom;
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      ctx.fillStyle = "#2d2d2d";
      for (let x = 0; x < displayWidth; x += gridSize * 2) {
        for (let y = 0; y < displayHeight; y += gridSize * 2) {
          ctx.fillRect(x, y, gridSize, gridSize);
          ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);
        }
      }
    }

    // 绘制帧
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frameCanvas, 0, 0, displayWidth, displayHeight);
  }, [asf, currentFrame, startFrame, zoom, showGrid]);

  // 切换方向
  const handleDirectionChange = useCallback((dir: number) => {
    setCurrentDirection(dir);
    setCurrentFrame(0);
  }, []);

  // 加载/错误状态
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto" />
          <span className="text-[#808080]">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-red-400">
          <span className="text-2xl">❌</span>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!asf) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-[#808080]">
          <span className="text-4xl">🎬</span>
          <p className="mt-4">选择一个 ASF 文件查看</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e] overflow-hidden">
      {/* 工具栏 */}
      <div className="flex shrink-0 items-center gap-4 border-b border-[#3c3c3c] bg-[#252526] px-4 py-2">
        {/* 文件名 */}
        <div className="flex-1">
          <span className="text-sm text-[#cccccc]">{fileName || "未选择"}</span>
        </div>

        {/* 播放控制 */}
        <div className="flex items-center gap-2">
          <button
            className="rounded px-2 py-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
            onClick={() => setCurrentFrame((prev) => Math.max(0, prev - 1))}
            title="上一帧"
          >
            ⏮
          </button>
          <button
            className="rounded px-3 py-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="rounded px-2 py-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
            onClick={() =>
              setCurrentFrame((prev) => (prev >= framesPerDirection - 1 ? 0 : prev + 1))
            }
            title="下一帧"
          >
            ⏭
          </button>
        </div>

        {/* 速度控制 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#808080]">速度:</span>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="rounded bg-[#3c3c3c] px-2 py-1 text-sm text-[#cccccc] border-none"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>

        {/* 缩放控制 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#808080]">缩放:</span>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="rounded bg-[#3c3c3c] px-2 py-1 text-sm text-[#cccccc] border-none"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
        </div>

        {/* 网格开关 */}
        <button
          className={`rounded px-2 py-1 text-sm ${
            showGrid ? "bg-[#0e639c]" : "hover:bg-[#3c3c3c]"
          } text-[#cccccc]`}
          onClick={() => setShowGrid(!showGrid)}
          title="显示网格"
        >
          #
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 min-h-0">
        {/* 预览区域 - 只有这里可以滚动 */}
        <div className="flex flex-1 min-w-0 items-center justify-center overflow-auto p-4">
          <canvas
            ref={canvasRef}
            className="border border-[#3c3c3c]"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* 信息面板 - 垂直滚动 */}
        <div className="w-64 shrink-0 border-l border-[#3c3c3c] bg-[#252526] p-4 overflow-y-auto">
          {/* 基础信息 */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-[#cccccc]">基础信息</h3>
            <div className="space-y-1 text-xs text-[#808080]">
              <div className="flex justify-between">
                <span>尺寸:</span>
                <span className="text-[#cccccc]">
                  {asf.width} × {asf.height}
                </span>
              </div>
              <div className="flex justify-between">
                <span>帧数:</span>
                <span className="text-[#cccccc]">{asf.frameCount}</span>
              </div>
              <div className="flex justify-between">
                <span>方向数:</span>
                <span className="text-[#cccccc]">{asf.directions}</span>
              </div>
              <div className="flex justify-between">
                <span>每方向帧:</span>
                <span className="text-[#cccccc]">{framesPerDirection}</span>
              </div>
              <div className="flex justify-between">
                <span>帧间隔:</span>
                <span className="text-[#cccccc]">{asf.interval}ms</span>
              </div>
              <div className="flex justify-between">
                <span>颜色:</span>
                <span className="text-[#cccccc]">
                  {asf.pixelFormat === 0 ? "真彩色 (RGBA)" : `${asf.colorCount}色`}
                </span>
              </div>
              {asf.pixelFormat !== undefined && (
                <div className="flex justify-between">
                  <span>像素格式:</span>
                  <span className="text-[#cccccc]">
                    {asf.pixelFormat === 0
                      ? "RGBA8"
                      : asf.pixelFormat === 1
                        ? "Indexed8"
                        : "Indexed8+Alpha"}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>偏移 (左, 底):</span>
                <span className="text-[#cccccc]">
                  {asf.left}, {asf.bottom}
                </span>
              </div>
            </div>
          </div>

          {/* 方向选择 */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-[#cccccc]">方向</h3>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: asf.directions }, (_, i) => (
                <button
                  key={i}
                  className={`rounded px-2 py-1 text-xs ${
                    currentDirection === i
                      ? "bg-[#0e639c] text-white"
                      : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                  }`}
                  onClick={() => handleDirectionChange(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* 帧进度 */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-[#cccccc]">帧</h3>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={framesPerDirection - 1}
                value={currentFrame}
                onChange={(e) => setCurrentFrame(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-16 text-right text-xs text-[#cccccc]">
                {currentFrame + 1} / {framesPerDirection}
              </span>
            </div>
          </div>

          {/* 帧缩略图 */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-[#cccccc]">帧列表</h3>
            <div className="grid grid-cols-4 gap-1 max-h-60 overflow-auto">
              {Array.from({ length: framesPerDirection }, (_, i) => {
                const frameIndex = startFrame + i;
                const frame = asf.frames[frameIndex];
                if (!frame) return null;

                return (
                  <button
                    key={i}
                    className={`aspect-square rounded border ${
                      currentFrame === i
                        ? "border-[#0e639c]"
                        : "border-[#3c3c3c] hover:border-[#5c5c5c]"
                    } overflow-hidden bg-[#1e1e1e]`}
                    onClick={() => setCurrentFrame(i)}
                    title={`帧 ${i + 1}`}
                  >
                    <FrameThumbnail frame={frame} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 帧缩略图组件
 */
function FrameThumbnail({
  frame,
}: {
  frame: { width: number; height: number; imageData: ImageData };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 创建临时 canvas 来获取 ImageData
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = frame.width;
    tempCanvas.height = frame.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.putImageData(frame.imageData, 0, 0);

    // 绘制到缩略图 canvas
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
