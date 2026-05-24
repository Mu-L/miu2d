/**
 * WebGL SpriteBatcher - 精灵批量渲染器（多纹理批处理版本）
 *
 * 核心性能优化组件：将成百上千次 drawImage 调用合并为少量 WebGL draw call。
 *
 * 多纹理批处理（multi-texture batching）：
 * - 单批次可同时绑定 MAX_TEXTURE_SLOTS 个不同纹理（典型 8）
 * - 每个 sprite 顶点带 a_texIndex（0..7），fragment shader 按索引采样
 * - 切纹理不再强制 flush —— 仅当 8 个槽位全满且来了第 9 个新纹理时才 flush
 * - 实测可将单 sprite/2 sprite 的小 batch 从 78% 降到 <10%
 *
 * 顶点格式 (每顶点 7 个 float):
 * [posX, posY, texU, texV, alpha, filterType, texIndex]
 *
 * 批量大小：最多 MAX_SPRITES_PER_BATCH 个精灵可以在一次 draw call 中绘制
 */

import { logger } from "../core/logger";
import type { GLStateCache } from "./gl-state-cache";
import { MAX_TEXTURE_SLOTS, type SpriteProgram } from "./shaders";
import type { ColorFilter, TextureId } from "./types";

/** 每个精灵的顶点数（2 个三角形 = 6 个顶点） */
const VERTICES_PER_SPRITE = 6;

/** 每个顶点的 float 数量 [x, y, u, v, alpha, filterType, texIndex] */
const FLOATS_PER_VERTEX = 7;

/** 每个精灵的 float 数量 */
const FLOATS_PER_SPRITE = VERTICES_PER_SPRITE * FLOATS_PER_VERTEX;

/** 单批次最大精灵数（8192 = 约 1.4MB buffer，覆盖绝大多数场景） */
const MAX_SPRITES_PER_BATCH = 8192;

/** ColorFilter → float ID 映射（传入 shader 的 a_filterType） */
const FILTER_TYPE_MAP: Record<ColorFilter, number> = {
  none: 0,
  grayscale: 1,
  frozen: 2,
  poison: 3,
};

export class SpriteBatcher {
  private gl: WebGLRenderingContext;
  private program: SpriteProgram;
  private state: GLStateCache;

  // GPU buffers
  private vbo: WebGLBuffer;
  private vao: WebGLVertexArrayObject | null = null;
  private vertexData: Float32Array;

  // 批次状态
  private spriteCount = 0;
  /** 当前 batch 已分配的纹理槽位：TextureId → slotIndex (0..7) */
  private slotMap = new Map<TextureId, number>();
  /** 每个槽位对应的 WebGLTexture（用于 flush 时实际绑定） */
  private slotTextures: (WebGLTexture | null)[] = new Array(MAX_TEXTURE_SLOTS).fill(null);
  /** 下一个待分配的槽位下标（0..MAX_TEXTURE_SLOTS） */
  private nextSlot = 0;

  /** u_textures 采样器 uniform 已初始化（值固定为 0..N-1，只需设置一次） */
  private samplersInitialized = false;

  // 统计
  private _drawCalls = 0;
  private _spriteCount = 0;
  private _textureSwaps = 0;

  constructor(gl: WebGLRenderingContext, program: SpriteProgram, state: GLStateCache) {
    this.gl = gl;
    this.program = program;
    this.state = state;

    // 创建顶点缓冲区
    this.vbo = gl.createBuffer()!;
    this.vertexData = new Float32Array(MAX_SPRITES_PER_BATCH * FLOATS_PER_SPRITE);

    // 设置缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);

    // 创建 VAO（WebGL2 原生支持），将顶点属性指针绑定到 VAO 避免每次 flush 重复设置
    const gl2 = gl as WebGL2RenderingContext;
    this.vao = gl2.createVertexArray();
    if (this.vao) {
      gl2.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

      const stride = FLOATS_PER_VERTEX * 4;
      gl.enableVertexAttribArray(program.a_position);
      gl.vertexAttribPointer(program.a_position, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(program.a_texcoord);
      gl.vertexAttribPointer(program.a_texcoord, 2, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(program.a_alpha);
      gl.vertexAttribPointer(program.a_alpha, 1, gl.FLOAT, false, stride, 16);
      gl.enableVertexAttribArray(program.a_filterType);
      gl.vertexAttribPointer(program.a_filterType, 1, gl.FLOAT, false, stride, 20);
      gl.enableVertexAttribArray(program.a_texIndex);
      gl.vertexAttribPointer(program.a_texIndex, 1, gl.FLOAT, false, stride, 24);

      gl2.bindVertexArray(null);
    }

    // 初始化构造期间直接调用了 GL，使外部缓存失效
    state.invalidateAll();

    logger.info(
      `[SpriteBatcher] Initialized: maxSprites=${MAX_SPRITES_PER_BATCH}, ` +
        `bufferSize=${(this.vertexData.byteLength / 1024).toFixed(1)}KB, ` +
        `texSlots=${MAX_TEXTURE_SLOTS}`
    );
  }

  /** 重置每帧统计 */
  resetStats(): void {
    this._drawCalls = 0;
    this._spriteCount = 0;
    this._textureSwaps = 0;
  }

  get drawCalls(): number {
    return this._drawCalls;
  }

  get totalSprites(): number {
    return this._spriteCount;
  }

  get textureSwaps(): number {
    return this._textureSwaps;
  }

  /**
   * 提交一个精灵到批次
   */
  draw(
    glTexture: WebGLTexture,
    textureId: TextureId,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    alpha: number,
    filter: ColorFilter
  ): void {
    // 分配槽位：复用已有 / 占用空闲 / 全满则 flush
    let slot = this.slotMap.get(textureId);
    if (slot === undefined) {
      if (this.nextSlot >= MAX_TEXTURE_SLOTS) {
        // 所有槽位已被占用，且来了新纹理 → flush 当前 batch
        this.flush();
      }
      slot = this.nextSlot++;
      this.slotMap.set(textureId, slot);
      this.slotTextures[slot] = glTexture;
      this._textureSwaps++;
    }

    // 批次满 → flush
    if (this.spriteCount >= MAX_SPRITES_PER_BATCH) {
      this.flush();
      // flush 后重新分配槽位（slotMap 已清空）
      slot = this.nextSlot++;
      this.slotMap.set(textureId, slot);
      this.slotTextures[slot] = glTexture;
      this._textureSwaps++;
    }

    // 写入顶点数据（2 个三角形 = 6 个顶点）
    const offset = this.spriteCount * FLOATS_PER_SPRITE;
    const data = this.vertexData;
    const a = alpha;
    const ft = FILTER_TYPE_MAP[filter];
    const si = slot;

    // 四个角的坐标
    const x0 = dx;
    const y0 = dy;
    const x1 = dx + dw;
    const y1 = dy + dh;
    const u0 = sx;
    const v0 = sy;
    const u1 = sx + sw;
    const v1 = sy + sh;

    // 三角形 1: 左上 → 右上 → 左下
    // 左上
    data[offset] = x0;
    data[offset + 1] = y0;
    data[offset + 2] = u0;
    data[offset + 3] = v0;
    data[offset + 4] = a;
    data[offset + 5] = ft;
    data[offset + 6] = si;
    // 右上
    data[offset + 7] = x1;
    data[offset + 8] = y0;
    data[offset + 9] = u1;
    data[offset + 10] = v0;
    data[offset + 11] = a;
    data[offset + 12] = ft;
    data[offset + 13] = si;
    // 左下
    data[offset + 14] = x0;
    data[offset + 15] = y1;
    data[offset + 16] = u0;
    data[offset + 17] = v1;
    data[offset + 18] = a;
    data[offset + 19] = ft;
    data[offset + 20] = si;

    // 三角形 2: 右上 → 右下 → 左下
    // 右上
    data[offset + 21] = x1;
    data[offset + 22] = y0;
    data[offset + 23] = u1;
    data[offset + 24] = v0;
    data[offset + 25] = a;
    data[offset + 26] = ft;
    data[offset + 27] = si;
    // 右下
    data[offset + 28] = x1;
    data[offset + 29] = y1;
    data[offset + 30] = u1;
    data[offset + 31] = v1;
    data[offset + 32] = a;
    data[offset + 33] = ft;
    data[offset + 34] = si;
    // 左下
    data[offset + 35] = x0;
    data[offset + 36] = y1;
    data[offset + 37] = u0;
    data[offset + 38] = v1;
    data[offset + 39] = a;
    data[offset + 40] = ft;
    data[offset + 41] = si;

    this.spriteCount++;
    this._spriteCount++;
  }

  /**
   * 刷新当前批次 → 提交到 GPU 绘制
   */
  flush(): void {
    if (this.spriteCount === 0) return;

    const gl = this.gl;
    const prog = this.program;
    const state = this.state;
    const gl2 = gl as WebGL2RenderingContext;

    // 使用精灵着色器（缓存：跨 flush 一般不变）
    state.useProgram(gl, prog.program);

    // sampler uniforms 值固定为 0..N-1，仅初始化一次
    if (!this.samplersInitialized) {
      for (let i = 0; i < MAX_TEXTURE_SLOTS; i++) {
        gl.uniform1i(prog.u_textures[i], i);
      }
      this.samplersInitialized = true;
    }

    // 绑定本批次实际用到的每个纹理到对应的 TEXTURE 单元
    for (let i = 0; i < this.nextSlot; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.slotTextures[i]);
    }

    // 绑定 VAO（缓存：跨 flush 一般不变）
    if (this.vao) {
      state.bindVAO(gl2, this.vao);
    }

    // 上传顶点数据（每次必须）
    // VAO 不保存 ARRAY_BUFFER 全局绑定，需显式绑定后 bufferSubData
    state.bindArrayBuffer(gl, this.vbo);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.vertexData.subarray(0, this.spriteCount * FLOATS_PER_SPRITE)
    );

    // 绘制
    gl.drawArrays(gl.TRIANGLES, 0, this.spriteCount * VERTICES_PER_SPRITE);

    // 重置 active texture 单元，保护外部代码（createTexture/updateTexture 等
    // 不主动设置 activeTexture，依赖默认为 TEXTURE0）
    if (this.nextSlot > 1) {
      gl.activeTexture(gl.TEXTURE0);
    }

    this._drawCalls++;
    this.spriteCount = 0;

    // 清空槽位映射准备下一批
    this.slotMap.clear();
    for (let i = 0; i < this.nextSlot; i++) {
      this.slotTextures[i] = null;
    }
    this.nextSlot = 0;
  }

  /**
   * 释放 GPU 资源
   */
  dispose(): void {
    const gl2 = this.gl as WebGL2RenderingContext;
    if (this.vao) {
      gl2.deleteVertexArray(this.vao);
      this.vao = null;
    }
    this.gl.deleteBuffer(this.vbo);
  }
}
