# ChemicalPrepare Reliability Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复关键计算和数据错误，并将单文件页面重构为可直接离线打开、可自动测试的数据驱动静态应用。

**Architecture:** 保留无构建静态网页，拆分 CSS、纯计算模块、抗生素数据和 DOM 交互。使用 Node 内置测试运行器执行公式、数据一致性及 HTML 静态测试。

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript, Node.js `node:test`

---

### Task 1: 建立回归测试基线

**Files:**
- Create: `tests/calculators.test.js`
- Create: `tests/data.test.js`
- Create: `tests/html.test.js`

- [ ] 写 12HEA 10 μM / 50 mL / 10 mM 应输出 50 μL 和 0.1% 的失败测试。
- [ ] 写 NaClO、菌悬液、Tween-20、dNTP 的非法输入和浓度倒置失败测试。
- [ ] 写抗生素默认值一致性及 HTML ID 唯一性失败测试。
- [ ] 运行 `node --test`，确认测试因模块缺失或现有缺陷而失败。

### Task 2: 提取纯计算和共享数据

**Files:**
- Create: `js/calculators.js`
- Create: `js/data.js`
- Modify: `index.html`

- [ ] 实现有限数、非负数、正数和稀释关系验证器。
- [ ] 实现培养基、稀释、12HEA、抗生素、PCR、dNTP 和凝胶纯计算函数。
- [ ] 建立含默认母液浓度、工作浓度、溶剂、保存和来源状态的抗生素数据。
- [ ] 运行 `node --test tests/calculators.test.js tests/data.test.js` 并确认通过。

### Task 3: 清理页面结构和样式

**Files:**
- Create: `styles.css`
- Modify: `index.html`

- [ ] 将内联 `<style>` 内容原样迁移到 `styles.css`。
- [ ] 删除重复的第二套 V8 自配区块，保留商品 2x 母液和一套自配计算器。
- [ ] 确保所有 HTML ID 唯一，并增加计算错误样式与来源徽标样式。
- [ ] 运行 `node --test tests/html.test.js` 并确认通过。

### Task 4: 重构页面交互

**Files:**
- Create: `js/app.js`
- Modify: `index.html`

- [ ] 将内联脚本迁移到 `js/app.js`，使用共享计算函数和统一错误渲染。
- [ ] 从共享抗生素数据生成表格及母液/工作液选项，并提供自定义浓度输入。
- [ ] 修复所有计算器的单位、校验和结果展示。
- [ ] 搜索整张卡片文本，保存并恢复标签页及展开状态。
- [ ] 增加折叠按钮键盘支持、`aria-expanded` 和输入标签关联。
- [ ] 运行全部 Node 测试。

### Task 5: 内容可靠性和文档同步

**Files:**
- Modify: `index.html`
- Modify: `README.md`

- [ ] 为关键配方和 Protocol 增加来源分级说明。
- [ ] 保留两套 HgCl2 时间，并注明流程专用与批次验证。
- [ ] 弱化无来源的绝对化措辞，标记待复核经验。
- [ ] 更新抗生素数量、项目结构、运行方式、测试命令和 2026-06-10 更新日志。

### Task 6: 完整验证

**Files:**
- Modify as needed based on verification findings.

- [ ] 运行 `node --test`，要求零失败。
- [ ] 运行 HTML ID 和脚本引用静态检查。
- [ ] 在浏览器打开 `index.html`，检查控制台、标签切换、V8、12HEA、抗生素、搜索和 Protocol 跳转。
- [ ] 检查 `git diff --check` 和最终变更范围，不触碰无关未跟踪文件。
