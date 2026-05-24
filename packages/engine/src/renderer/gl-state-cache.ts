/**
 * GLStateCache - 跨 batcher/renderer 共享的 WebGL 状态缓存
 *
 * WebGL 命令缓冲是性能瓶颈：每次 `flush()` 重复执行 `useProgram`、
 * `bindBuffer`、`bindVertexArray`、`uniform1i` 等 GL 调用会在
 * 高分辨率/多 batch 场景下让 GPU 命令缓冲饱和。
 *
 * 实测前：一帧 ~590 个 drawArrays × 8 个 GL 调用 ≈ 4700 GL 调用，
 * 其中绝大多数是冗余（program/buffer/VAO 跨 flush 不变）。
 *
 * 通过共享一份"当前状态"快照，所有 batcher 在 flush 前用 cache 助手
 * 跳过冗余调用，保留必需的 bindTexture/bufferSubData/drawArrays。
 *
 * 注意：WebGL 上下文跨帧保持状态，因此缓存无需在帧间重置；只在
 * 外部直接修改 GL 状态（如 init/resize 中的 useProgram）时调用
 * invalidate*() 失效相应字段。
 */
export class GLStateCache {
  currentProgram: WebGLProgram | null = null;
  currentVAO: WebGLVertexArrayObject | null = null;
  currentArrayBuffer: WebGLBuffer | null = null;

  useProgram(gl: WebGLRenderingContext, program: WebGLProgram): void {
    if (this.currentProgram !== program) {
      gl.useProgram(program);
      this.currentProgram = program;
    }
  }

  bindVAO(gl2: WebGL2RenderingContext, vao: WebGLVertexArrayObject | null): void {
    if (this.currentVAO !== vao) {
      gl2.bindVertexArray(vao);
      this.currentVAO = vao;
    }
  }

  bindArrayBuffer(gl: WebGLRenderingContext, buffer: WebGLBuffer | null): void {
    if (this.currentArrayBuffer !== buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      this.currentArrayBuffer = buffer;
    }
  }

  /** 外部直接调用 GL 修改状态后必须失效对应字段。 */
  invalidateAll(): void {
    this.currentProgram = null;
    this.currentVAO = null;
    this.currentArrayBuffer = null;
  }

  invalidateProgram(): void {
    this.currentProgram = null;
  }
}
