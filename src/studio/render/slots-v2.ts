/**
 * NailSlot V2 加载器（DEV-PLAN §5.11 · UI 组件化 Phase 2）
 *
 * 契约来源：assets/nail-slots/slots.back.v2.json（calibration.status=approved,
 * calibrationVersion=back-v2.1.0，2026-07-27 人工签收）。
 *
 * 与 legacy（nail-assets.ts 的 anchor/nailScale/PX_PER_MM）彻底分离：
 * 本模块只用「界标仿射 matrix + 局部 UV」投影，禁止再引入 nailScale。
 *
 * 局部 UV 契约：rootCenter(0.5,1) · tipCenter(0.5,0) · u 左→右；
 * 长度规则：甲根（v=1）固定，长度只向甲尖方向延伸（extendSlotToLengthMm）。
 *
 * 注意：plate PNG 内联为 dataURL —— 预览 svg 会被序列化为 blob 离屏栅格化
 * （export-png.ts），<img> 上下文禁止外部子资源，相对/绝对 URL 都会失败。
 */

import type { NailLengthMm, NailSlotV2, NailSlotsV2File } from '@/studio/slots';
import { extendSlotToLengthMm } from '@/studio/slots';

export interface BackPlateV2 {
  /** plate PNG 的 dataURL（内联进 svg <image>，保证离屏导出一致） */
  plateDataUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  /** 线稿甲代表的物理长度（必填，见 slots.back.v2.json referenceLengthMm） */
  referenceLengthMm: NailLengthMm;
  slots: NailSlotV2[];
  calibrationVersion: string;
}

const SLOTS_V2_URL = '/assets/nail-slots/slots.back.v2.json';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`资产加载失败：${url}（HTTP ${res.status}）`);
  return (await res.json()) as T;
}

async function fetchDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`资产加载失败：${url}（HTTP ${res.status}）`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`plate 编码失败：${url}`));
    reader.readAsDataURL(blob);
  });
}

let cache: Promise<BackPlateV2> | null = null;

/** 加载已签收的 Back 视图 V2 plate + slots（模块级缓存，失败自动失效） */
export function loadBackPlateV2(): Promise<BackPlateV2> {
  if (!cache) {
    cache = (async () => {
      const file = await fetchJson<NailSlotsV2File>(SLOTS_V2_URL);
      const platePath = file.plate.file ?? file.plate.path;
      if (!platePath) throw new Error('slots.back.v2.json 缺少 plate.file');
      const plateDataUrl = await fetchDataUrl(`/${platePath.replace(/^\//, '')}`);
      const calibration = (file as { calibration?: { calibrationVersion?: string } }).calibration;
      if (!file.referenceLengthMm) {
        throw new Error(
          'slots.back.v2.json 缺少 referenceLengthMm：线稿甲代表的物理长度必须显式标定，' +
            '否则长度切换会让甲片缩进/超出线稿甲床。',
        );
      }
      return {
        plateDataUrl,
        sourceWidth: file.plate.sourceWidth,
        sourceHeight: file.plate.sourceHeight,
        referenceLengthMm: file.referenceLengthMm,
        slots: file.slots,
        calibrationVersion: calibration?.calibrationVersion ?? 'unknown',
      };
    })();
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

/** 按目标长度调整 slots：甲根固定，甲尖沿中轴伸缩（契约：length_rule） */
export function slotsForLength(plate: BackPlateV2, lengthMm: NailLengthMm): NailSlotV2[] {
  return plate.slots.map((s) => extendSlotToLengthMm(s, lengthMm, plate.referenceLengthMm));
}

/**
 * 设计内容（0.1mm 剪影坐标系：原点甲根中心、甲尖负 y）→ 局部 UV 的变换串。
 * u = (x + W10/2) / W10 · v = (y + L10) / L10
 * 即：甲根中心 → (0.5,1)；甲尖（y=−L10）→ v=0；甲根宽 → u∈[0,1]。
 * 外层再套 slot.transform（UV → stage px）即完成投影。
 */
export function contentUvTransform(widthMm: number, lengthMm: number): string {
  const w10 = widthMm * 10;
  const l10 = lengthMm * 10;
  const f = (n: number) => Number(n.toFixed(8));
  return `scale(${f(1 / w10)} ${f(1 / l10)}) translate(${f(w10 / 2)} ${f(l10)})`;
}

/** 每 0.1mm 设计单位对应的 stage px（u 向），用于描边宽度换算 */
export function pxPerDesignUnit(slot: NailSlotV2, widthMm: number): number {
  return slot.nailBedWidthPx / (widthMm * 10);
}
