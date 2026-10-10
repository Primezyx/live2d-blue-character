# v08 肢体舞蹈制作记录

配方：revisions/manifest-v08.json；HD 注入配方：manifest-hd-portable.json。所有图像路径为相对路径并经过存在性检查。

四肢取自 v07 修复后 body 原像素，分成左右两条连续手臂网格、两条连续腿网格；上臂与前臂、大小腿内部保持连续。手指旁的裙边留在躯干，透明手/裙间隙的一个孤立白底残片只修改 alpha。未重新生成脸或服装。注册 body 位于画布 (9,315)，此文件为 538×1151。模型画布 560×1480。

8 个原生关节参数：ParamArmR/L、ParamElbowR/L、ParamHipR/L、ParamKneeR/L。R/L 为角色解剖方向。新增 keyform 由 toolchain/articulated-export/ManifestExport.kt 生成，读取 config.articulated_joints。沿用现有 psd2live 锁定版本与补丁，Gradle exportManifest 的 agentKitIntegrationDir 应指向此 articulated-export 目录。无需改动原版 kit 的 integrations。

肩/髋附着点使用平滑过渡，肘/膝连续网格按原图铰链位置弯曲。原生参数具有宽编辑范围；交付舞蹈将抬臂限制在 ±48°、弯肘限制在 ±58°，以保持肩部三角形方向。检查范围为交付舞蹈的 0.2、1、1.5 倍幅度与 24 秒完整时间轴，未声称任意 8 参数极限组合都通过视觉验收。

../delivery/preview/dance.js 为确定性 24 秒/120 BPM 编排：2–8 秒交替抬腿和对侧摆臂，8–12 秒展开，12–16 秒交替挥手，16–20 秒加快小步，20 秒后收势。20 条原生参数曲线按 60 FPS 输出；根容器平移和旋转恒为零。耳发、眨眼与头身节奏沿用原模型能力。可选节拍为浏览器本地合成。

PSD/注册图层为原分辨率；CMO3-HD 中的纹理由 8192 图集重建。模型运行包单独交付。Core、JDK、Gradle、NCNN 可执行文件/权重与 node_modules 不包含在此包内；验证脚本需在已有授权环境中使用。原生与网页验证及精确 SHA 见 ../docs/validation-v08.json。
