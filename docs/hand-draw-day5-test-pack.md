# Day 5 美甲师手绘验证测试包

> H0 假设验证：美甲师是否愿意用 Web 2D 画布替代纸上/实物试色设计  
> 入口：`/design/canvas?blank=1`（almond · medium · 奶白底色）

## 测试前准备

1. 启动：`npm run dev`
2. 登录 P 端 → **我的设计** → **空白新建**（或 Wizard 桥接后进入 Editor）
3. 确认左侧工具栏：画笔 B / 橡皮 E / **法式边模板** / 120色 品牌色板 / 细·标·粗 线宽
4. 打开浏览器 DevTools → Application → localStorage → `editor.handdraw.session`（会话埋点）

## 固定任务（10 分钟内完成）

| # | 任务 | 操作指引 | 验收 |
|---|---|---|---|
| 1 | 灰调玫瑰金法式边 | 选 R4 → 点击 **法式边模板** → 经典弧 → 填色灰调白、边线玫瑰金 → LayerPanel 微调距甲尖/线宽 | 单甲可见填色区 + 微笑线，无需纯手绘 |
| 2 | 无名指小雏菊 | 解锁 L4 → 细线 → 白色/奶白 → 画 5 瓣 + 点珠花心 → **镜像对侧** 到 R4 | 双手无名指对称 |
| 3 | 食指金属波纹 | L2 → 细线 → 金属灰/银 → 画 2–3 条波纹线 → **十指平铺** 查看整体 | 5×2 预览协调 |

## 必测功能点

- [ ] 撤销 ⌘Z / 重做 ⌘⇧Z（至少 5 步）
- [ ] 120 色品牌色板（OPI/CND/Essie 切换）
- [ ] 线宽三档（细/标/粗）
- [ ] 法式边一键模板（经典弧 / V形 / 双线 + 填色/边线可调）
- [ ] 镜像对侧指（仅图案 / 含底色 两种模式）
- [ ] 左手→右手 批量镜像
- [ ] 十指平铺预览 + 导出 PNG（含手绘）
- [ ] 图层 panel：①底色 ②图案 ③附件

## Go / No-Go 记录表

| 美甲师 | 完成时间 | 满意度 /10 | 使用镜像？ | undo 次数 | 主要反馈 |
|---|---|---|---|---|---|
| #1 | | | | | |
| #2 | | | | | |
| #3 | | | | | |

**成功标准**：≥3 人、10 分钟内完成、平均满意度 ≥7、≥2 人主动用镜像

**失败信号**：「不如纸上画快」「手势不习惯」「镜像角度不对不愿用」

## 会话指标读取

```javascript
JSON.parse(localStorage.getItem('editor.handdraw.session'))
// { strokeCount, frenchEdgeCount, undoCount, mirrorUsed, mirrorCount, startedAt, completedAt? }
```

测试结束时在控制台执行：

```javascript
localStorage.setItem('editor.handdraw.session', JSON.stringify({
  ...JSON.parse(localStorage.getItem('editor.handdraw.session')),
  completedAt: new Date().toISOString()
}))
```

## 重置会话

```javascript
localStorage.removeItem('editor.handdraw.session')
```
