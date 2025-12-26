# 数据库设计优化文档 - 2025年最佳实践

## 设计原则

本文档基于 **2025 年业界最佳实践** 重新设计，遵循以下核心原则：

### 1. 字段设计规范

- **命名规范**：数据库字段使用 `snake_case`，Entity 属性使用 `camelCase`
- **单数形式**：`address` 不 `addresses`，`user_wallet` 不 `user_wallets`
- **简洁命名**：避免前缀重复，如 `user_id` 而非 `wallet_user_id`
- **中文注释**：每个字段都标注中文说明

### 2. 数据类型优化

| 使用场景 | 2025 推荐 | 原因 |
|---------|---------|-----|
| 主键 | `BIGINT` (自增) | 常规表用整数 PK，性能更好 |
| 金额 | `BIGINT`（乘以decimals） | 避免浮点精度问题，TRON: ×10^6, ETH: ×10^18 |
| 时间戳 | `TIMESTAMP` | 使用 `@CreateDateColumn` 装饰器自动维护 |
| 状态 | `TINYINT` | 使用数值 enum 替代字符串，节省空间、提升查询性能 |
| 扩展数据 | `JSON` | 替代多个 nullable 字段 |
| 软删除 | `TIMESTAMP nullable` | `deleted_at` 字段，查询时 WHERE deleted_at IS NULL |

### 3. 索引策略

- **减少索引**：仅为高频查询路径创建索引
- **复合索引**：(user_id, chain) 优于两个单列索引
- **部分索引**：WHERE deleted_at IS NULL 仅索引活跃数据
- **性能评估**：每个索引都会增加写入成本

---

## 核心表设计

### 表1: user_wallet（用户钱包地址）

**用途**：管理用户在不同区块链上的充值/提现/归集地址

```sql
CREATE TABLE user_wallet (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL,            -- 外锫关联user表
  chain TINYINT NOT NULL,             -- 0=TRON, 1=ETH
  type TINYINT DEFAULT 0,             -- 0=DEPOSIT, 1=WITHDRAWAL, 2=SWEEP
  address VARCHAR(255) NOT NULL UNIQUE,
  public_key VARCHAR(255) NOT NULL,
  private_key_encrypted VARCHAR(1024),
  status TINYINT DEFAULT 0,           -- 0=ACTIVE, 1=DISABLED
  balance BIGINT DEFAULT 0,         -- 已乘以 decimals
  derivation_index SMALLINT DEFAULT 0,
  label VARCHAR(255),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- 仅保留必需索引
CREATE UNIQUE INDEX idx_user_chain_type ON user_wallet(user_id, chain, type) 
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_wallet_address ON user_wallet(address) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_user ON user_wallet(user_id);
```

**字段说明**：
- `id`: 自增主键（数字）
- `balance`: 链上实时余额（仅用于监控，不作为账户余额）
  - TRON: 数值已乘以 10^6（SUN），e.g., 500 TRX = 500_000_000
  - ETH: 数值已乘以 10^18（WEI），e.g., 1 ETH = 1_000_000_000_000_000_000
- `type`: 支持多种钱包类型（充值/提现/自动归集）
- `metadata`: 扩展信息（JSON）

---

### 表2: deposit_order（充值订单）

**用途**：完整记录用户充值交易的生命周期（PENDING → CONFIRMED → SETTLED）

```sql
CREATE TABLE deposit_order (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL,            -- 外锫关联user表
  wallet_address_id BIGINT NOT NULL,
  chain TINYINT NOT NULL,             -- 0=TRON, 1=ETH
  token VARCHAR(50) NOT NULL,
  amount BIGINT NOT NULL,           -- 已乘以 decimals
  tx_hash VARCHAR(255) NOT NULL UNIQUE,
  confirmations SMALLINT DEFAULT 0,
  confirm_num SMALLINT NOT NULL,
  status TINYINT DEFAULT 0,           -- 0=PENDING, 1=CONFIRMED, 2=SETTLED, 3=FAILED, 4=REVERTED
  from_address VARCHAR(255) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  block_number BIGINT DEFAULT 0,
  idempotent_key VARCHAR(128) UNIQUE,
  failure_reason VARCHAR(500),
  metadata JSON,                    -- gas_used, gas_price, nonce 等
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- 性能索引
CREATE INDEX idx_deposit_user_status ON deposit_order(user_id, status);
CREATE INDEX idx_deposit_txhash ON deposit_order(tx_hash);
CREATE INDEX idx_deposit_wallet ON deposit_order(wallet_address_id);
CREATE INDEX idx_deposit_created ON deposit_order(created_at) 
  WHERE status != 'SETTLED';
```

**关键设计**：
- `idempotent_key`: 防止重复处理同一笔交易
- `amount`: 充值金额（已乘以 decimals）
- `metadata`: 存储 gas 等动态字段，避免表结构频繁变更

---

### 表3: withdrawal_order（提现订单）

**用途**：记录用户提现请求的完整流程

```sql
CREATE TABLE withdrawal_order (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL,
  chain TINYINT NOT NULL,             -- 0=TRON, 1=ETH
  token VARCHAR(50) NOT NULL,
  amount BIGINT NOT NULL,           -- 已乘以 decimals
  to_address VARCHAR(255) NOT NULL,
  fee BIGINT NOT NULL,              -- 手续lv（已乘以 decimals）
  status TINYINT DEFAULT 0,           -- 0=PENDING, 1=APPROVED, 2=PROCESSING, 3=CONFIRMED, 4=SETTLED, 5=CANCELLED, 6=FAILED
  tx_hash VARCHAR(255),
  approved_by VARCHAR(255),
  failure_reason VARCHAR(500),
  confirmations SMALLINT DEFAULT 0,
  confirm_num SMALLINT DEFAULT 12,
  batch_id VARCHAR(128),            -- 批量处理支持
  idempotent_key VARCHAR(128) UNIQUE,
  metadata JSON,                    -- suggested_gas_price, approvers, nonce
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- 索引策略
CREATE INDEX idx_withdrawal_user_status ON withdrawal_order(user_id, status);
CREATE INDEX idx_withdrawal_txhash ON withdrawal_order(tx_hash) 
  WHERE tx_hash IS NOT NULL;
CREATE INDEX idx_withdrawal_created ON withdrawal_order(created_at) 
  WHERE status != 'SETTLED';
```

**特点**：
- `status`: 支持多阶段审核流程
- `batch_id`: 支持批量提现场景
- `metadata`: 审批历史、推荐 gas 价格等信息

---

### 表4: block_height_record（区块高度记录）

**用途**：跟踪链同步进度，支持链重组回滚

```sql
CREATE TABLE block_height_record (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  chain TINYINT NOT NULL UNIQUE,      -- 0=TRON, 1=ETH
  last_scanned_block BIGINT NOT NULL,
  last_confirmed_block BIGINT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**说明**：
- `last_scanned_block`: 最后扫描的块高（可能包含未确认块）
- `last_confirmed_block`: 最后确认的块高（用于可靠性）

---

### 表5: chain（区块链配置）

**用途**：动态管理多条区块链的配置，支持链的启用/禁用

```sql
CREATE TABLE chain (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code VARCHAR(50) NOT NULL UNIQUE,  -- TRON, ETH, POLYGON...
  name VARCHAR(100) NOT NULL,
  status TINYINT DEFAULT 0,           -- 0=ACTIVE, 1=MAINTENANCE, 2=DISABLED
  rpc_url VARCHAR(500) NOT NULL,
  confirm_num SMALLINT NOT NULL,
  block_time SMALLINT NOT NULL,      -- 平均出块时间（秒）
  decimals SMALLINT NOT NULL,        -- 原生代币精度
  fee_model VARCHAR(50) NOT NULL,    -- fixed / dynamic
  config JSON,                       -- 扩展配置（API密钥、超时等）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_chain_code ON chain(code);
CREATE INDEX idx_chain_status ON chain(status);
```

**运维优势**：
- 无需修改代码即可启用新链
- 可快速禁用出问题的链（维护模式）
- 支持灵活的 RPC 切换

---

### 表6: token（代币配置）

**用途**：管理每条链上支持的代币，包含精度、限额等信息

```sql
CREATE TABLE token (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  chain_id BIGINT NOT NULL,
  code VARCHAR(50) NOT NULL,         -- TRX, ETH, USDT...
  name VARCHAR(100) NOT NULL,
  status TINYINT DEFAULT 0,           -- 0=ACTIVE, 1=SUSPENDED, 2=DELISTED
  contract_address VARCHAR(255),     -- ERC20/TRC20 合约
  decimals SMALLINT NOT NULL,
  deposit_enabled BOOLEAN DEFAULT true,
  withdrawal_enabled BOOLEAN DEFAULT true,
  min_deposit BIGINT,
  min_withdrawal BIGINT,
  max_withdrawal BIGINT,
  config JSON,                       -- logo, CMC ID, 能量消耗等
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_token_chain_code ON token(chain_id, code);
CREATE INDEX idx_token_status ON token(status);
```

---

### 表7: audit_log（审计日志）

**用途**：记录所有关键操作（合规、风控、故障排查）

```sql
CREATE TABLE audit_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT,                     -- 外锫关联user表
  action TINYINT NOT NULL,            -- 0=CREATE, 1=UPDATE, 2=DELETE, 3=APPROVE, 4=REJECT, 5=SIGN, 6=BROADCAST, 7=SETTLE
  entity_type TINYINT NOT NULL,       -- 0=USER, 1=WALLET, 2=DEPOSIT, 3=WITHDRAWAL, 4=CHAIN, 5=RISK_RULE
  entity_id BIGINT NOT NULL,
  description VARCHAR(500) NOT NULL,
  old_value JSON,
  new_value JSON,
  result VARCHAR(50) NOT NULL,       -- SUCCESS / FAILED
  error_message VARCHAR(1000),
  ip_address VARCHAR(50),
  user_agent VARCHAR(500),
  context JSON,                      -- request_id, duration_ms 等
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 优化索引（仅90天内数据）
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at) 
  WHERE created_at > now() - interval '90 days';
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_action ON audit_log(action);
```

**合规特性**：
- INSERT ONLY（不可修改、不可删除）
- 完整上下文记录（IP、User-Agent 等）
- 支持时间分区（后续优化）

---

### 表8: rate_limit（速率限制配置）

**用途**：防止 DDoS 和滥用，配置动态可调

```sql
CREATE TABLE rate_limit (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  type TINYINT NOT NULL,              -- 0=DEPOSIT, 1=WITHDRAWAL, 2=LOGIN, 3=API
  target VARCHAR(50) NOT NULL,       -- user_id / ip / global
  target_value VARCHAR(255),
  period TINYINT NOT NULL,            -- 0=SECOND, 1=MINUTE, 2=HOUR, 3=DAY, 4=MONTH
  max_count INT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  action VARCHAR(50) DEFAULT 'REJECT',  -- REJECT / QUEUE / THROTTLE
  remark VARCHAR(500),
  config JSON,                       -- whitelist, alert_threshold 等
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_rate_limit_target ON rate_limit(type, target);
CREATE INDEX idx_rate_limit_enabled ON rate_limit(enabled);
```

**运维优势**：
- 实时计数存储在 Redis，配置在 PostgreSQL
- 受攻击时可立即降低限制
- 支持用户分级限制

---

## 2025 年数据库最佳实践总结

| 原则 | 实践 | 好处 |
|-----|-----|-----|
| **精度处理** | 使用 BIGINT 存储金额（乘以 decimals） | 避免浮点精度问题，确保账务准确 |
| **扩展性** | JSON 字段替代多列 | 减少表修改，快速支持新功能 |
| **软删除** | 添加 deleted_at 字段 | 完整的数据追溯和恢复能力 |
| **幂等性** | idempotent_key 字段 | 网络重试时防止重复处理 |
| **索引优化** | 仅创建必需索引 | 降低写入成本，提升整体性能 |
| **字段命名** | 数据库 snake_case，代码 camelCase | 与工业标准一致，代码可读性高 |
| **审计链路** | 完整的操作日志 | 满足合规要求（SOX、PCI-DSS） |
| **动态配置** | Chain、Token、RateLimit 表 | 无需发布就能调整系统行为 |

---

## 迁移策略

### 初始化脚本

所有表都通过 TypeORM Migration 创建，支持版本管理和回滚：

```bash
npm run migration:run      # 执行迁移
npm run migration:revert   # 回滚
```

### 字段对应关系

| 数据库字段 | Entity 属性 |
|----------|-----------|
| `user_id` | `userId` |
| `wallet_address_id` | `walletAddressId` |
| `tx_hash` | `txHash` |
| `from_address` | `fromAddress` |
| `to_address` | `toAddress` |
| `block_number` | `blockNumber` |
| `private_key_encrypted` | `privateKeyEncrypted` |
| `idempotent_key` | `idempotentKey` |
| `deleted_at` | `deletedAt` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |

---

## 性能优化建议

### 1. 查询优化
```typescript
// ✅ 好的做法：按索引字段查询
await userWalletRepository.findOne({ 
  where: { userId, chain } 
});

// ❌ 避免：按非索引字段查询
await userWalletRepository.find({ 
  where: { label: 'xxx' } 
});
```

### 2. 批量操作
```typescript
// ✅ 使用 createQueryBuilder 批量插入
await depositOrderRepository
  .createQueryBuilder()
  .insert()
  .into(DepositOrderEntity)
  .values(orders)
  .execute();
```

### 3. 时间分区（未来优化）
```sql
-- 按月分区 audit_log 表
CREATE TABLE audit_log_202501 PARTITION OF audit_log
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

## 附录：完整 Entity 参考

所有 Entity 已在 `src/modules/*/entities/` 目录下实现，包括：

- ✅ `UserWalletEntity` - 用户钱包
- ✅ `DepositOrderEntity` - 充值订单
- ✅ `WithdrawalOrderEntity` - 提现订单
- ✅ `BlockHeightRecordEntity` - 区块追踪
- ✅ `ChainEntity` - 链配置
- ✅ `TokenEntity` - 代币配置
- ✅ `AuditLogEntity` - 审计日志
- ✅ `RateLimitEntity` - 速率限制
