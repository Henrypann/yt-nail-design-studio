import type { FlatVectorToolV7 } from './flat-vector';

export const FLAT_TOOL_PANEL_MAP_V7 = {
  select: {
    label: '选择与锚点',
    description: '选择、移动现有元素，或编辑矢量路径锚点。',
    tools: ['select', 'anchor'],
    showDrawingStyle: false,
  },
  brush: {
    label: '自由画笔',
    description: '使用颜色与物理线宽绘制 nail-local 路径。',
    tools: ['brush'],
    showDrawingStyle: true,
  },
  eraser: {
    label: '非破坏遮罩',
    description: '橡皮与区域遮罩不会删除原始图形。',
    tools: ['eraser', 'region_mask'],
    showDrawingStyle: true,
  },
  line: {
    label: '线条',
    description: '拖拽创建直线，颜色与线宽由当前样式决定。',
    tools: ['line'],
    showDrawingStyle: true,
  },
  shape: {
    label: '参数图形',
    description: '选择矩形、圆形或星形，然后在甲面拖拽物化路径。',
    tools: ['rectangle', 'circle', 'star'],
    showDrawingStyle: true,
  },
  french: {
    label: '法式曲线',
    description: '添加一条 geometry-relative 法式边缘，再编辑宽度与弧度。',
    tools: ['french'],
    showDrawingStyle: true,
  },
} as const satisfies Record<string, {
  label: string;
  description: string;
  tools: readonly FlatVectorToolV7[];
  showDrawingStyle: boolean;
}>;

export type FlatToolPanelModeV7 = keyof typeof FLAT_TOOL_PANEL_MAP_V7;
export type EditorResourceModeV7 = FlatToolPanelModeV7 | 'text' | 'assets';

export function isFlatToolPanelModeV7(mode: EditorResourceModeV7): mode is FlatToolPanelModeV7 {
  return mode in FLAT_TOOL_PANEL_MAP_V7;
}
