# 部署到 Render（浏览器版）

本次更新的主版本在 `web/`，为独立 HTML5 游戏；不是 Godot Web 导出。Godot 工程和浏览器版仍是两套实现，浏览器版的新美术、触屏和机制不会自动同步到 Godot。

## 本地运行

在仓库根目录运行 `python3 -m http.server 8000 --directory web`，浏览器访问 `http://localhost:8000`。也可直接打开 `web/index.html`；素材与脚本都在本地，没有 CDN、账户、后端或密钥依赖。

## 一键部署

[部署到 Render](https://render.com/deploy?repo=https://github.com/ljiaming-0218/OverloadZone_Godot4)

登录 Render 并授权访问此仓库后，确认创建 Blueprint。配置自动读取根目录 `render.yaml`，无需填写构建参数。此链接是部署入口，不是已上线的游戏地址。

## Render 静态站点

1. 把代码提交并推送到自己的 GitHub 仓库。
2. 登录 Render，选择 **New → Blueprint**，连接 `ljiaming-0218/OverloadZone_Godot4`，选择含本次改动的分支。Render 读取根目录 `render.yaml`，审阅并创建服务。
3. 也可手动选择 **New → Static Site**。Root Directory 留空，Build Command 为 `echo 'Static game'`，Publish Directory 为 `web`。不要选择需要常驻进程的 Web Service。
4. 部署完成后使用 Render 生成的 HTTPS 地址。手机直接打开该地址即可；以后推送代码可触发自动部署。

不需要 Node、Godot 引擎、数据库、支付服务或环境变量。静态站点的可用套餐与费用以 Render 控制台当前显示为准。

## 发布后验收

- 首页显示「下班大作战」，怪物素材与开始按钮正常，无 404。
- 电脑 WASD / 方向键移动，Space 冲刺吸弹，Q 掀桌爆发；数字 1/2/3 选升级。
- 手机左侧摇杆移动、右侧冲刺和掀桌，可同时按住；自动瞄准射击；横竖屏均可。
- 音效在首次点击开始后解锁；若手机静音，检查系统音量与网页声音按钮。
- 切走页面或失去焦点自动暂停，返回后点击继续；旋转屏幕后控制不会卡住。
- 实机检查 iPhone Safari 与 Android Chrome 的触控、音频、帧率和发热。模拟器不能证明实机性能。

代码推送与 Render 上线是两个步骤。已有服务若开启 main 分支自动部署，推送会触发更新；是否成功须在 Render 控制台查看。没有服务时使用上方部署入口创建。

## 下班大作战更新

新版入口仍为 `web/index.html`，保持 `web` 发布目录，整目录一起发布。脚本为 `office.js`、`tactics.js`、`combat.js`、`campaign.js` 和 `game.js`，素材为 `assets/office-enemies.png`、`assets/office-bosses.png`、`assets/office-floor.png`；仍使用 `backstage-bodies.png` 与 `backstage-vfx.png`。无需变更构建命令。

发布后确认首页保留「更换头像」，没有小剧场入口，点击开始直接战斗。头像设置可导入本地照片、刷新保留、恢复姓名牌；沿用旧浏览器存储键，兼容旧版照片。更换域名或设备不会自动带走头像。Boss 实时登场，前两场胜利直接选遗物，最终胜利直接出现「打卡成功」。

暂停手册显示六条进化配方。实战检查锅盖护送、狙击锁定、治疗 / 召唤打断、乌鸦协同射击和 Boss 蓄力破招。Godot 原型未同步这些浏览器版内容。
