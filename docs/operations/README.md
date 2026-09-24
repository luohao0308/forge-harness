# 运维与发布入口

_状态：active | 权威范围：环境、发布、健康、观测和恢复流程 | 更新：2026-08-10_

## 环境索引

| 环境 | 用途 | 发布入口 | 健康/冒烟 | 观测入口 | 权限边界 |
|---|---|---|---|---|---|
| local | 本地开发/文档验证 | `docker compose ... up`、各应用 `npm run dev` | `/api/health/readiness`、定向 smoke | Compose logs、本地 OTel（如启用） | 本地可逆 |
| CI/test | PR/release gates | `.github/workflows/` | pytest/Ruff/Vitest/build/docs/compose | CI artifacts、workflow logs | workflow permissions |
| production | 受控私有部署 | `scripts/release.sh`、Compose/Helm runbooks | readiness、业务 smoke、migration checks | Prometheus/Grafana/Loki/Tempo/OTel | 明确授权 |

不要在本文记录密码、Token、私钥、完整环境变量或可直接使用的生产凭据。动态地址、版本、镜像和拓扑必须标注验证时间，并在操作前重新核验。

## 文档入口

- [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)：发布前检查、迁移、切换、验证和回滚。
- [OBSERVABILITY.md](OBSERVABILITY.md)：日志、指标、追踪、健康信号和排障入口。
- [deployment-operations.md](deployment-operations.md)：部署形态、Sandbox、WarmPool、指标和告警。
- [mobile/phase7-mobile-release.md](mobile/phase7-mobile-release.md)：移动端验证和凭据门禁发布步骤。
- [runbooks/](runbooks/)：团队共享、可重复验证的操作与部署 Runbook；作为项目源文档进入 Git 评审。
- 部署流水、发布日志、动态环境快照和完整命令输出：保存在 CI/部署平台或受控日志系统，不提交到源码仓库。

## 发布原则

- `privilegedOperationsDefault=deny`：tag/Release、package/image publish、deploy、migration/backfill、rollback、traffic switch、仓库设置、凭据和发布工作流操作不进入普通初始化。
- 每次高权限操作必须按 repo/环境、operation、不可变版本或产物、目标、actor、expiry 单独授权；push、PR 或 merge 权限不能推导出发布权限。
- 代码托管和部署平台使用 branch protection、required checks、CODEOWNERS/独立审批和 environment approval 强制门禁；本地 manifest 不能替代远端控制。
- 发布目标使用不可变版本身份（commit、tag、digest 或等价物）。
- 任何数据迁移先确认备份、恢复和兼容顺序。
- 先 Preflight，再构建/部署，再健康检查、业务冒烟和观测。
- 失败时按预先定义的停止条件回滚或前滚，不在生产现场临时发明流程。
- 完成记录包含版本身份、执行人/入口、验证证据和剩余风险。
- 动态地址、镜像、端口、容量、凭据状态和第三方配额不能直接从历史文档复用，操作前重新 Preflight。
