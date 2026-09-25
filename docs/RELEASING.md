# GitHub Release 发布

工作流会为 Linux `amd64` 与 `arm64` 分别构建前后端 Docker 镜像，打包成离线部署包，
并把压缩包及 SHA-256 校验文件附到 GitHub Release。服务器只需 Docker 与 Compose v2，
不需要 Python、Node.js 或现场构建。独立的 Windows/macOS 可执行程序不在当前构建范围内。

## 本机授权

不需要把访问令牌发给协作者或填入本项目的 `.env`。在 macOS 终端运行：

```bash
brew install gh
gh auth login --hostname github.com --web --scopes workflow
```

按提示打开浏览器，输入终端的一次性验证码，点击 **Continue → Authorize GitHub CLI**。
`workflow` scope 用于推送工作流文件。之后运行 `gh auth status` 确认授权成功。
仓库目前使用 SSH remote；Git 推送仍需可用的 SSH 密钥。需要改用本机的 CLI 登录凭据时：

```bash
git remote set-url origin https://github.com/1273082756/Mailpass.git
gh auth setup-git
```

## 第一次发布

1. 将 `.github/workflows/release.yml`、打包脚本、部署模板及相关改动提交并推送到默认分支。
2. 打开仓库 **Settings → Actions → General**。如果 Actions 被禁用，启用它，并允许工作流使用的 GitHub、Docker 和 Bun 官方 actions。
3. 打开仓库主页右侧 **Releases → Draft a new release**。
4. 点击 **Choose a tag**，输入 `v1.0.0`，选择 **Create new tag**；Target 选择包含上述改动的分支或提交。
5. 填写版本标题与说明，点击 **Publish release**。
6. 打开 **Actions → Release packages** 查看进度。两种架构的构建和部署检查通过后，附件会自动出现在 Release 的 **Assets** 下。

工作流使用 GitHub 自动提供的 `GITHUB_TOKEN`，只在上传附件的 job 中申请 `contents: write`。
无需添加 Personal Access Token、Docker Hub 密码或额外的 Actions Secrets。
若组织策略禁止该权限，需要由组织管理员放行；个人仓库通常无需额外操作。

产物示例：

```text
mailpass-v1.0.0-linux-amd64.tar.gz
mailpass-v1.0.0-linux-amd64.tar.gz.sha256
mailpass-v1.0.0-linux-arm64.tar.gz
mailpass-v1.0.0-linux-arm64.tar.gz.sha256
```

下载目标架构的文件后，在同一目录执行 `sha256sum -c <压缩包名>.sha256` 验证，
解压后按包内 README 配置 `.env`，运行 `bash start.sh`。MX 记录与入站 SMTP 端口仍需在服务器和域名侧配置。

## 重试与预发布

- 失败后可在 Actions 运行详情中点击 **Re-run failed jobs**。
- 也可打开 **Actions → Release packages → Run workflow**，输入已有 Release 的标签重新构建；同名附件会被替换。
- `v1.0.0-rc.1` 等预发布标签也受支持。发布时勾选 **Set as a pre-release** 即可。
- 只保存为 Draft 不会触发自动构建；可使用 Run workflow 为已有的草稿 Release 构建并上传附件，检查完毕后再发布。发布时若两种架构的压缩包及校验文件均已存在，工作流会跳过重复构建。
- 标签必须包含本次新增的 Dockerfile 参数和打包脚本；为旧提交的标签运行新工作流无法补齐这些文件。
- GitHub 的 immutable releases 功能若已启用，请先对草稿运行工作流并上传附件，再正式发布；发布后不能追加或替换附件。
