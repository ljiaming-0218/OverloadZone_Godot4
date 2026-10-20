# 过载禁区 · OVERLOAD ZONE

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ljiaming-0218/OverloadZone_Godot4)

点击上方按钮，在 Render 登录并确认创建静态站点。手机打开部署生成的 HTTPS 地址即可游玩。

冲刺吸弹 → 反击超频 → 过载清场的动作肉鸽原型。

## 浏览器 / 手机试玩（本次改进的主版本）

打开 `web/index.html`，或在仓库根目录运行：

```sh
python3 -m http.server 8000 --directory web
```

电脑：WASD / 方向键移动，Space 冲刺，Q 过载，数字 1/2/3 选择升级，Esc 暂停。自动瞄准开火，可按住鼠标手动瞄准。

手机：左摇杆移动，右侧双按钮冲刺 / 过载；支持多点触控、横竖屏、自动瞄准和失焦暂停。点击开始后音效解锁，可用顶部声音按钮静音。手机浏览器通过 HTTPS 站点打开最方便。

- 吸弹：100 范围吸收，增加能量、短时反击超频、护盾，并缩短冲刺冷却。
- 过载：分层冲击波、短暂顿帧、分支电弧和单次击破统计。
- 构筑：死亡电弧 / 爆破连锁、追踪导弹、冰霜穿甲减速、近身电刃等不同打法；首次升级提供明确的三种方向。
- 美术：生成的机甲与敌方无人机精灵图、工业地面；音效为本地 Web Audio 合成，无外部 CDN 或 API。
- 不含账户、服务器、云存档或内购。3 分钟生存，2:00 Boss 入侵，击破核心获胜。

部署说明见 [DEPLOY_RENDER.md](DEPLOY_RENDER.md)，根目录 `render.yaml` 可供 Render Blueprint 使用。发布目录是 `web`。

## Godot 工程

使用 Godot 4.3+ Standard 导入 `project.godot`。Linux 环境已用 Godot 4.6.3 验证导入与无界面启动，修复了 `game.gd` 的布尔类型推断错误。

**Godot 与 HTML5 是两套实现。本次新机制、美术、音效和手机控制在 `web/`；没有自动同步到 Godot。** 旧说明见 [README_开始游戏.md](README_开始游戏.md)。

## 验证

机制测试：`node --test tests/game.test.cjs`（只需 Node，不需要安装 npm 包）。浏览器适配仍需在真实 iPhone Safari / Android Chrome 试听、操作和检查性能；模拟手机尺寸不能代表实机测试。
