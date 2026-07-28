/**
 * 十指预览 SVG → PNG 导出（Studio-PRD §12.4 右栏 [导出预览 PNG]）
 *
 * 原型期 PNG 为唯一导出形态（§9 红线），也是线下确认的展示载体。
 * 渲染器 svg 通过 registerPreviewSvg 注册；导出时序列化内联 SVG（皮肤色 token
 * 回退值就地展开），经 Canvas 2x 栅格化后触发下载。
 */

let currentSvg: SVGSVGElement | null = null;

/** 渲染器挂载时注册当前预览 svg（卸载/切换时更新） */
export function registerPreviewSvg(el: SVGSVGElement | null): void {
  currentSvg = el;
}

/** 当前是否有可导出的预览 */
export function hasPreviewSvg(): boolean {
  return currentSvg !== null;
}

/** 序列化预览 svg（展开 CSS 变量回退值，保证离屏栅格化一致） */
function serializePreview(): string {
  if (!currentSvg) throw new Error('预览尚未就绪，无法导出');
  const clone = currentSvg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '1200');
  clone.setAttribute('height', '900');
  let markup = new XMLSerializer().serializeToString(clone);
  // 离屏环境无文档 CSS：将 token 引用替换为其回退值
  markup = markup
    .replace(/var\(--skin-base,\s*([^)]+)\)/g, '$1')
    .replace(/var\(--skin-outline,\s*([^)]+)\)/g, '$1');
  return markup;
}

/** 预览 svg → PNG Blob（scale=2 高清导出） */
export async function renderPreviewPng(scale = 2): Promise<Blob> {
  const markup = serializePreview();
  const svgUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('预览图像栅格化失败'));
      el.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1200 * scale;
    canvas.height = 900 * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画布初始化失败');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG 编码失败'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** 生成设计列表缩略图（dataURL，失败时返回 undefined，不阻断保存） */
export async function renderThumbnailDataUrl(): Promise<string | undefined> {
  try {
    const blob = await renderPreviewPng(0.4);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('缩略图编码失败'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
