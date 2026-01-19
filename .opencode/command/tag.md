---
description: "创建新的补丁版本 tag"
model: anthropic/claude-haiku-4-5
---

# 创建版本 Tag

执行以下步骤：

1. **获取远程最新信息**
   ```bash
   git fetch --tags
   ```

2. **查看本地和远程最新 tag**
   ```bash
   git tag --sort=-v:refname | head -10
   ```

3. **分析当前最新版本**
   - 找出最新的语义化版本 tag（格式：vX.Y.Z 或 X.Y.Z）
   - 解析 major、minor、patch 版本号

4. **计算新的补丁版本**
   - 保持 major 和 minor 不变
   - patch 版本号 +1
   - 例如：v1.2.3 → v1.2.4

5. **输出创建命令**
   
   不要自动执行，只输出以下命令供用户手动执行：
   
   ```
   # 创建本地 tag
   git tag <新版本号>
   
   # 推送到远程
   git push origin <新版本号>
   ```

## 注意事项

- 如果没有找到任何 tag，建议从 v0.0.1 开始
- 确保当前分支已提交所有更改
- 输出命令时使用具体的版本号，不要使用占位符
