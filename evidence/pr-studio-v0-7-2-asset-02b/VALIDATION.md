# STUDIO-v0.7.2-ASSET-02B｜Strict Starter Asset Preflight

## 状态

- `READY(branch) / prototype`：Branch B 实现，尚未 fast-forward 到 `main`。
- preflight 只消费已解析的 ASSET-02A shelf entry/read model、shape 和依赖注入 byte loader。
- `rights=PENDING`、`promotion=BLOCKED`、`manufacturingValidated=false` 为固定输出；不写入 UI、Wizard Store、EditorDoc、Community 或资产源。

## 验收

| 检查 | 结果 |
|---|---|
| 10 candidates × 7 shapes：EXACT=63、UNAVAILABLE=7（Petal Pearl） | PASS |
| registry mapping、assetId/revision/SHA/kind/mime/path/shape identity | PASS |
| shelf entry exact-key/非空唯一 labels、lifecycle/capability/blocker parser | PASS |
| `sortOrder` finite integer；fractional/NaN entry fail closed | PASS |
| Web Crypto 实际 bytes SHA-256 重算 | PASS |
| wrong bytes、loader throw、missing bytes、identity/path/revision drift | PASS |
| governance unlock、four Look exclusion、writer-zero/no mutation | PASS |
| output exact-key：EXACT diagnostics=[]+assetRef；UNAVAILABLE diagnostics 非空+assetRef=null；负例覆盖 | PASS |
| owner rights/capability/production signoff | PENDING；本 PR 不生成相关证据 |

## 边界

`EXACT` 只表示当前 canonical official template registry ref（含 templateId/shape identity）与注入 bytes 的技术身份和 digest 一致；本 PR 未读取或验证 manifest，因此不宣称 manifest 验证，也不表示版权、可制作、商业授权或制造验证。其使用范围始终为 `LOCAL_CONCEPT_DRAFT_ONLY`。

Starter Shelf 的 `sortOrder` 是依据 material index 显式 `sort_order` 排序后的稳定整数 rank；源 index 的既有小数值仅用于确定顺序，不直接暴露到严格 read model。
