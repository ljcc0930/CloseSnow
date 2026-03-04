# CloseSnow Feature Design: Resort Hourly Multi-Line Charts

Date: 2026-03-04  
Owner: CloseSnow (personal-use full-info mode)

## 1. Feature Goal

在雪场 hourly 页面（`/resort/<resort_id>`）中，将当前的小时级参数从“仅表格展示”升级为“每个参数独立折线图展示”，提高趋势可读性，保持“信息全面、不过度决策化”的产品定位。

核心要求：
- 每个参数都要有对应折线图。
- 不替代现有数据，仅增强展示（图 + 表可共存）。

## 2. In Scope

仅针对雪场 hourly 页面：
- 动态模式：`/api/resort-hourly` 拉取数据
- 静态模式：`resort/<id>/hourly.json` 拉取数据（无后端 API 依赖）

参数范围（每个参数一张折线图）：
1. `snowfall`（cm）
2. `rain`（mm）
3. `precipitation_probability`（%）
4. `snow_depth`（m）
5. `wind_speed_10m`（km/h）
6. `wind_direction_10m`（deg）
7. `visibility`（m）

## 3. Out of Scope

- 不新增决策建议（例如“今天是否适合滑雪”）。
- 不改变后端数据来源模型（仍使用当前 hourly payload）。
- 不在主页面（`/`）增加图表。

## 4. Current Baseline

当前 hourly 页面已有：
- 小时范围切换（24/48/72/120）
- 元信息（hours/timezone/model）
- 错误提示
- 参数表格

当前 hourly payload 已包含上述 7 个参数，满足图表数据前提。

## 5. UX / Product Requirements

## 5.1 Layout

页面结构调整为：
1. 标题 + 控件区（保留）
2. 元信息区（保留）
3. 图表区（新增）
4. 表格区（保留，作为明细）

图表区要求：
- 每个参数一个独立图表卡片（7 张）。
- 卡片包含：标题、单位、图表主体。
- 默认按固定顺序展示（与参数列表一致）。

## 5.2 Chart Interaction

统一交互要求：
- 切换小时范围后，7 张图同时刷新。
- 点击 Refresh 后，7 张图同时刷新。
- 图表 hover 显示 tooltip：`time + value + unit`。
- 缺失值不报错，显示为断点（gap），不连接假值。

## 5.3 Axis Rules

- X 轴：`hourly.time`（本地时区显示，与 meta 的 timezone 一致）。
- Y 轴：
  - 自动缩放，保留合理上下边距。
  - `precipitation_probability` 强制范围 `0~100`。
  - 其余指标按数据范围自动。

## 5.4 Visual Consistency

- 单图单线，不做多参数叠图。
- 每个参数使用固定颜色，避免刷新后颜色变化。
- 图表需适配桌面与移动端（小屏不溢出，允许纵向堆叠）。

## 5.5 Wind Direction Special Rule

`wind_direction_10m` 仍使用折线图（按需求“每个参数都做折线图”）：
- 默认显示 `0~360` 度数。
- 接受跨 360/0 的跳变线段（不引入复杂极坐标或向量图）。

## 6. Frontend Functional Requirements

建议新增模块：
- `assets/js/resort_hourly_charts.js`（或并入 `resort_hourly.js`）

必须满足：
1. 能从现有 payload 读取 7 个数组并构建 7 张图。
2. 支持动态 API payload 与静态 `hourly.json` payload（同一逻辑）。
3. 当某参数全为空时，图表显示 `No data` 占位，不影响其他图表。
4. 保持现有表格渲染能力，图表失败不应阻断表格展示（降级策略）。

## 7. Backend Requirements

本功能默认不要求新增后端接口。  
当前 `/api/resort-hourly` 返回结构满足需求。

可选增强（非必需）：
- 在 hourly payload 中补充 `units` 字段，减少前端硬编码单位。

## 8. Static/Dynamic Compatibility Requirements

必须保证两种运行模式都可正常显示图表：

1. 动态模式：
- 从 `/api/resort-hourly?resort_id=...&hours=...` 获取数据。

2. 静态模式：
- 从 `window.CLOSESNOW_HOURLY_CONTEXT.hourlyDataUrl` 获取本地 JSON。
- 不能出现 `fetch failed`（若本地文件存在）。

## 9. Performance Requirements

- 120 小时下（7 图 + 表）首次渲染应保持可交互，不出现明显卡顿。
- 切换小时范围时，不重复初始化图表实例（优先更新数据而非销毁重建）。
- 避免内存泄漏（页面重复刷新后实例数量稳定）。

## 10. Accessibility Requirements

- 图表区域每张卡片有语义标题（可被屏幕阅读器读取）。
- 颜色不是唯一信息源；tooltip 文本必须可读。
- 错误状态与空数据状态有明确文字提示。

## 11. Acceptance Criteria

满足以下条件视为通过：

1. `/resort/<id>` 页面可见 7 张参数折线图，且与表格参数一一对应。
2. 切换 `24/48/72/120` 后，7 张图的点数与范围同步变化。
3. 动态模式与静态模式均可正常显示图表。
4. 某参数缺失时仅该图显示空状态，其余图不受影响。
5. 页面无 JS 报错，现有表格功能保持可用。

## 12. Suggested Execution Order

1. 图表框架接入与单图 PoC（`snowfall`）。
2. 抽象通用 chart renderer（参数化配置）。
3. 一次性接入其余 6 个参数。
4. 接入静态/动态双数据源。
5. 补充测试与样式调优。

## 13. Test Plan (Minimum)

自动化测试：
- 前端单元测试：
  - 参数映射到图表配置
  - 空数据/缺失数据降级逻辑
  - 小时切换后的数据裁剪逻辑
- 集成测试：
  - 静态 hourly 页面包含图表容器
  - 动态 hourly 页面路由可返回并渲染图表脚本

手工验证：
1. 打开任一雪场页面，确认 7 张图出现。
2. 切换小时范围，观察 7 图同步更新。
3. 在静态产物中打开雪场页面，确认无 `fetch failed`。

