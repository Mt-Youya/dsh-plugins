# 多帧 zstd 必须逐帧切分

DSH 的 `session.v4.jsonl.zstd` 是多帧追加的。`zlib.zstdDecompressSync` 与 `createZstdDecompress` 在本机两个运行时（Electron 44.7/node 24.21、系统 node 24.19）上**只解第一帧且不报错**：272 帧的样本返回 284 B，真实应 955,090 B，静默丢失 99.97%。

**决策**：按 `28 b5 2f fd` 扫描切帧后逐帧 `zstdDecompressSync` 再拼接。已全量验证 131/131 会话、38,384 帧、0 坏帧，产物 sha256 与 `zstd -dc` 一致。只取元数据时只解最后 1–3 帧。

**Consequences**：切帧依赖魔数扫描，理论上存在压缩载荷内偶现魔数的假阳性（实测 38,384 帧 0 例）；若 DSH 更换容器格式，解析须重做。
