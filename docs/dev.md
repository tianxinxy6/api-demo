# 中心化交易所钱包系统 - 开发计划文档

**文档时间**: 2025年12月
**项目类型**: 中小型项目
**预计周期**: 16 周

---

## 一、项目概述

### 1.1 项目背景与目标
开发一款类似币安、欧易等主流交易所的中心化钱包系统，支持用户在交易所内进行数字资产的充值、提现、转账等操作。核心目标是构建安全、稳定、高性能的钱包系统，支持主流稳定币 USDT 的链上充值，兼容多链生态（TRC20、ERC20），确保资金安全和用户资产安全。

### 1.2 项目范围与分期
**第一期（16周）**：USDT 充值系统 + 基础提现框架
**第二期（待定）**：完整提现功能、更多币种支持、内部转账
**第三期（待定）**：高级功能、风控系统完善

### 1.3 核心团队与技术栈
- **后端框架**: NestJS + TypeScript
- **数据库**: PostgreSQL + Redis
- **链交互**: Web3.js / Ethers.js + Tron Web SDK
- **消息队列**: Bull（任务队列）
- **部署**: Docker + Kubernetes（可选）

---

## 二、第一阶段：基础架构与需求分析（1-2周）

### 2.1 目标
- 完成需求细化和技术方案设计
- 搭建项目基础架构
- 准备开发环境和测试网络

### 2.2 工作内容

#### 2.2.1 需求与设计文档
| 任务 | 描述 | 工作量 | 负责人 |
|------|------|--------|--------|
| 需求细化 | 与产品团队确认功能需求、业务流程、风控要求 | 2天 | PM/技术主管 |
| 系统设计 | 绘制系统架构、数据流图、时序图 | 3天 | 技术主管/高级开发 |
| 数据库设计 | 设计钱包、充值、提现、交易等核心表结构 | 2天 | DBA/后端主管 |
| 安全评审 | 制定密钥管理、私钥存储、地址生成等安全策略 | 2天 | 安全工程师 |
| API 规范 | 设计 REST API 接口、参数校验、错误码规范 | 1天 | 后端主管 |

#### 2.2.2 技术基础搭建
```typescript
// 项目结构规划
src/
├── modules/
│   ├── wallet/                 # 钱包模块
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── entities/
│   │   ├── dto/
│   │   └── wallet.module.ts
│   ├── chain/                  # 链交互模块
│   │   ├── services/
│   │   ├── providers/
│   │   └── chain.module.ts
│   ├── deposit/                # 充值模块
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── listeners/
│   │   └── deposit.module.ts
│   ├── withdrawal/             # 提现模块
│   ├── transaction/            # 交易模块
│   └── admin/                  # 管理后台
├── common/
│   ├── decorators/
│   ├── interceptors/
│   ├── filters/
│   ├── guards/
│   └── pipes/
├── config/                     # 配置文件
├── entities/                   # 全局 Entity
├── constants/                  # 常量
└── utils/                      # 工具函数
```

#### 2.2.3 开发环境准备
- 搭建 Tron 测试网络环境（Shasta）
- 搭建以太坊测试网络环境（Sepolia）
- 部署合约交互工具和监听服务
- 配置 Redis、PostgreSQL 本地环境
- 建立 CI/CD 流程基础

### 2.3 交付物
- 《需求规范书》
- 《系统架构设计文档》
- 《数据库设计文档》
- 《API 接口文档》
- 《安全策略文档》
- 基础项目骨架代码

---

## 三、第二阶段：钱包地址与用户管理（3-4周）

### 3.1 目标
- 实现用户钱包地址的生成与管理
- 建立钱包与用户账户的关联关系
- 完成钱包地址的查询和管理功能

### 3.2 核心功能开发

#### 3.2.1 数据模型设计

```typescript
// User Wallet 表
UserWallet {
  id: UUID
  userId: UUID
  chain: 'TRON' | 'ETH'
  address: string              // 充值地址
  publicKey: string            // 公钥
  status: 'ACTIVE' | 'DISABLED'
  balance: decimal             // 链上余额（仅监控）
  createdAt: DateTime
  updatedAt: DateTime
}

// Wallet Address Log 表
WalletAddressLog {
  id: UUID
  walletId: UUID
  action: 'CREATED' | 'ENABLED' | 'DISABLED'
  operator: string
  createdAt: DateTime
}
```

#### 3.2.2 核心服务

| 服务 | 功能描述 | 技术细节 |
|------|--------|--------|
| WalletService | 钱包创建、查询、启用/禁用 | 地址唯一性验证、重复创建防护 |
| AddressGeneratorService | 地址生成 | TRON: Tron Web SDK；ETH: ethers.js |
| KeyManagementService | 密钥存储与管理 | 加密存储、HSM 集成预留 |
| BlockchainService | 链交互基础 | Web3 提供者封装、网络切换 |

#### 3.2.3 关键 API 端点

```
POST   /api/v1/wallets/addresses/generate
GET    /api/v1/wallets/addresses/{userId}
GET    /api/v1/wallets/addresses/{userId}/{chain}
PATCH  /api/v1/wallets/addresses/{addressId}/status
GET    /api/v1/wallets/addresses/{addressId}/detail
```

#### 3.2.4 实现要点
- **地址生成策略**
  - 使用分层确定性钱包（HD Wallet）衍生地址
  - 支持批量预生成地址，提高响应速度
  - 实现地址复用管理（针对提现功能预留）

- **安全性**
  - 私钥不直接存储在应用层，使用 HSM 或专用密钥服务
  - 密钥使用完整加密方案（AES-256）
  - 实现访问控制和审计日志

- **可靠性**
  - 地址唯一性约束（业务 + 数据库约束）
  - 异常重试机制
  - 地址生成失败降级方案

### 3.3 测试计划
- 单元测试：地址生成算法、校验逻辑
- 集成测试：钱包创建、地址生成端到端流程
- 测试网验证：在 Tron Shasta、Sepolia 上验证地址有效性

### 3.4 交付物
- 完整的钱包地址管理 API
- 地址生成服务单元测试 > 80% 覆盖率
- 《密钥管理方案文档》

---

## 四、第三阶段：充值监听与交易处理（5-7周）

### 4.1 目标
- 构建链上交易监听系统
- 实现充值交易的确认与到账处理
- 建立充值数据的完整记录和对账机制

### 4.2 核心功能开发

#### 4.2.1 数据模型设计

```typescript
// Deposit Order 表
DepositOrder {
  id: UUID
  userId: UUID
  walletAddressId: UUID
  chain: 'TRON' | 'ETH'
  token: 'USDT'
  amount: decimal
  txHash: string
  confirmations: int           // 当前确认数
  confirmNum: int   // 需要的确认数（链上交易需要多少个块确认）
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'FAILED'
  fromAddress: string
  fee: decimal
  createdAt: DateTime
  updatedAt: DateTime
}

// Block Height Record 表
BlockHeightRecord {
  id: UUID
  chain: 'TRON' | 'ETH'
  lastScannedBlock: bigint     // 最后扫描的块高
  lastConfirmedBlock: bigint   // 最后确认的块高
  updatedAt: DateTime
}
```

#### 4.2.2 监听系统架构

```
┌─────────────────────────────────────────────────────┐
│          Chain Listener Service (定时任务)           │
│  - TRON 监听 (每 3 秒)                             │
│  - ETH 监听 (每 12 秒)                             │
└──────────────┬──────────────────────────────────────┘
               │
        ┌──────▼──────┐
        │ 获取新块信息 │
        └──────┬──────┘
               │
        ┌──────▼───────────────────────────────┐
        │ 遍历交易，匹配已登记的充值地址         │
        └──────┬───────────────────────────────┘
               │
        ┌──────▼────────────────────┐
        │ 创建 Deposit Order Record  │
        └──────┬────────────────────┘
               │
        ┌──────▼─────────────────────┐
        │ 发送确认监听任务到消息队列  │
        └──────┬─────────────────────┘
               │
        ┌──────▼──────────────────────────┐
        │ Confirmation Processor (后台任务)│
        │ - 监听交易确认数变化              │
        │ - 达到要求确认数则标记为已确认    │
        └──────┬──────────────────────────┘
               │
        ┌──────▼─────────────────┐
        │ 触发充值到账事件        │
        │ - 更新用户账户余额      │
        │ - 生成充值记录          │
        │ - 发送通知              │
        └──────────────────────────┘
```

#### 4.2.3 关键服务

| 服务 | 功能 | 技术细节 |
|------|------|--------|
| ChainListenerService | 链上交易监听 | 定时扫块、事件监听、重试机制 |
| DepositService | 充值订单管理 | 订单创建、状态更新、金额校验 |
| ConfirmationService | 确认监听 | 确认数计算、达成条件判断 |
| SettlementService | 充值结算 | 余额更新、事件发送、异常处理 |
| EventPublisher | 事件发布 | 充值完成事件、异常事件 |

#### 4.2.4 关键 API 端点

```
GET    /api/v1/deposits/orders
GET    /api/v1/deposits/orders/{orderId}
GET    /api/v1/deposits/history/{userId}
GET    /api/v1/deposits/status/{txHash}
```

#### 4.2.5 实现要点

**监听策略**
- 支持两种监听模式：
  - 定时扫块（稳定性强，适合中小项目）
  - WebSocket 事件监听（实时性强，适合实时场景）
- 块高的持久化存储，断点续扫
- 支持链重组（Reorg）检测和处理

**确认机制**
- TRON：需要 19 个块确认（约 1 分钟）
- ETH：需要 12 个块确认（约 3 分钟）
- 可配置的确认数阈值

**可靠性设计**
- 重复交易检测（txHash 唯一性）
- 金额精度处理（使用 Decimal/BigInt）
- 异常交易（异常 GAS 费、异常金额）的人工审核流程
- 链分叉（Reorg）的回滚处理

**性能优化**
- 批量获取块数据减少 RPC 调用
- 使用 Redis 缓存最新块高信息
- 缓存已验证的合约地址信息
- 并发处理多链监听

#### 4.2.6 对账机制

```typescript
// 对账服务设计
class ReconciliationService {
  // 定期（每天一次）与链上数据对账
  async reconcileDepositOrders() {
    // 1. 获取数据库中未确认的订单
    // 2. 查询链上交易实时状态
    // 3. 更新数据库记录
    // 4. 生成对账报告
    // 5. 异常订单人工审核
  }
}
```

### 4.3 测试计划
- 单元测试：金额计算、确认数逻辑、状态转换
- 集成测试：端到端充值流程、重试机制、异常处理
- 压力测试：高并发充值监听、大块数据处理
- 测试网验证：真实链上测试、块重组场景模拟

### 4.4 交付物
- 完整的链上监听系统
- 充值订单管理 API
- 《监听系统设计文档》
- 《对账机制文档》
- 后台任务服务 Docker 镜像

---

## 五、第五阶段：风控与安全体系（7-9周）

### 5.1 目标
- 建立充值风控系统
- 实现异常交易检测与预警
- 完善安全审计机制

### 5.2 核心功能开发

#### 5.2.1 风控规则引擎

```typescript
// 风控规则类型
RiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

风控规则：
1. 金额限制
   - 单笔充值上限：$100,000
   - 单日充值上限：$500,000
   - 账户一小时内最多 10 笔充值

2. 异常检测
   - 异常 GAS 费（> 3倍历史均值）
   - 异常充值频率（10 分钟内 > 5 笔）
   - 新地址首笔充值（人工审核）

3. 地址风险
   - 黑名单地址检测
   - 混币器/隐私币地址检测
   - Dusting 攻击检测

4. 用户风险
   - 首次充值验证
   - 异常用户行为（IP、设备变化）
   - KYC 等级限制
```

#### 5.2.2 数据模型

```typescript
// Risk Alert 表
RiskAlert {
  id: UUID
  depositOrderId: UUID
  riskLevel: RiskLevel
  riskType: string             // 风控规则类型
  description: string
  status: 'PENDING' | 'REVIEWED' | 'APPROVED' | 'REJECTED'
  reviewedBy: string
  createdAt: DateTime
}

// Whitelist Address 表
WhitelistAddress {
  id: UUID
  chain: string
  address: string
  status: 'ACTIVE' | 'INACTIVE'
  addedBy: string
  createdAt: DateTime
}

// Blacklist Address 表
BlacklistAddress {
  id: UUID
  chain: string
  address: string
  reason: string
  createdAt: DateTime
}
```

#### 5.2.3 关键 API 端点

```
GET    /api/v1/admin/risk-alerts
PATCH  /api/v1/admin/risk-alerts/{alertId}/review
GET    /api/v1/admin/whitelist-addresses
POST   /api/v1/admin/whitelist-addresses
GET    /api/v1/admin/blacklist-addresses
POST   /api/v1/admin/blacklist-addresses
```

#### 5.2.4 实现要点
- 支持动态规则配置，无需发版
- 风控规则可配置优先级和阈值
- 异常交易自动隔离，人工审核
- 完整的审计日志记录所有风控操作

### 5.3 安全审计系统

```typescript
// 审计日志记录
AuditLog {
  id: UUID
  action: string               // 操作类型
  operator: string
  resourceType: string
  resourceId: string
  oldValue: JSON
  newValue: JSON
  timestamp: DateTime
  ipAddress: string
  userAgent: string
}
```

### 5.4 交付物
- 风控规则引擎实现
- 风控管理后台 API
- 《风控规则文档》
- 《安全审计规范》

---

## 六、第六阶段：提现功能框架（9-11周）

### 6.1 目标
- 实现提现订单管理
- 建立提现审核流程
- 完成链上发送交易功能

### 6.2 核心功能开发

#### 6.2.1 数据模型设计

```typescript
// Withdrawal Order 表
WithdrawalOrder {
  id: UUID
  userId: UUID
  chain: 'TRON' | 'ETH'
  token: 'USDT'
  amount: decimal
  toAddress: string            // 提现到账地址
  fee: decimal                 // 预估手续费
  status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  txHash: string              // 链上交易 Hash
  approvedBy: string          // 审核人员
  failureReason: string
  createdAt: DateTime
  updatedAt: DateTime
}

// Withdrawal Request 表（记录提现申请流程）
WithdrawalRequest {
  id: UUID
  withdrawalOrderId: UUID
  status: 'SUBMITTED' | 'REVIEWING' | 'APPROVED' | 'REJECTED'
  submittedAt: DateTime
  reviewedAt: DateTime
  reviewer: string
  rejectionReason: string
}

// Withdrawal Fee Config 表
WithdrawalFeeConfig {
  id: UUID
  chain: string
  token: string
  feeType: 'FIXED' | 'PERCENT'  // 固定费用或百分比
  fee: decimal
  minAmount: decimal           // 最低提现金额
  maxAmount: decimal           // 最高提现金额
  dailyLimit: decimal          # 每日限额
  updatedAt: DateTime
}
```

#### 6.2.2 提现流程

```
用户申请提现
    ▼
金额、地址校验
    ▼
风控检查（同充值）
    ▼
提交审核（PENDING 状态）
    ▼
管理员审核与批准
    ▼
自动发送链上交易 (PROCESSING)
    ▼
监听交易确认
    ▼
结算完成 (COMPLETED)
```

#### 6.2.3 关键 API 端点

```
POST   /api/v1/withdrawals/orders
GET    /api/v1/withdrawals/orders
GET    /api/v1/withdrawals/orders/{orderId}
PATCH  /api/v1/withdrawals/orders/{orderId}/cancel
GET    /api/v1/admin/withdrawal-requests
PATCH  /api/v1/admin/withdrawal-requests/{requestId}/approve
PATCH  /api/v1/admin/withdrawal-requests/{requestId}/reject
```

#### 6.2.4 关键服务

| 服务 | 功能 | 技术细节 |
|------|------|--------|
| WithdrawalService | 提现订单管理 | 订单创建、状态管理、金额校验 |
| AddressValidationService | 地址验证 | 地址格式、黑名单检查、自托管地址检查 |
| WithdrawalApprovalService | 审核流程 | 规则审批、人工审批 |
| TxSendingService | 链上交易发送 | 私钥签名、GAS 优化、重试机制 |
| WithdrawalConfirmationService | 确认监听 | 与充值类似的确认逻辑 |

#### 6.2.5 实现要点

**提现地址管理**
- 支持白名单地址快速提现
- 新地址提现需要强制人工审核
- 防止自托管地址（钱包地址）的提现风险

**交易发送与签名**
- 使用冷钱包或硬件钱包签名
- 支持多重签名机制
- GAS 费用自适应调整
- 失败重试机制（3 次重试，间隔递增）

**审核流程**
- 支持两级审核（初审、复核）
- 自动规则审批与人工审批结合
- 审核超时自动升级

### 6.3 测试计划
- 单元测试：地址验证、金额计算、手续费计算
- 集成测试：提现全流程、审核流程、异常处理
- 测试网验证：链上交易真实发送和确认

### 6.4 交付物
- 完整的提现订单管理系统
- 链上交易发送服务
- 《提现流程文档》
- 《GAS 费用优化文档》

---

## 七、第七阶段：管理后台与运维（11-13周）

### 7.1 目标
- 构建管理后台系统
- 实现运维监控和告警
- 完成系统日志和数据分析

### 7.2 核心功能开发

#### 7.2.1 管理后台功能

| 功能模块 | 功能描述 |
|--------|--------|
| 仪表板 | 充值/提现实时统计、待审核订单数、风控告警等 |
| 订单管理 | 充值/提现订单查询、详情查看、手动审核 |
| 用户管理 | 用户信息查看、钱包地址管理、提现白名单管理 |
| 风控管理 | 风控规则配置、告警查看、异常订单处理 |
| 财务对账 | 日终对账、收入统计、手续费统计 |
| 系统管理 | 角色权限管理、操作日志查看、配置管理 |
| 链数据管理 | 块高管理、交易重新扫描、链状态监控 |

#### 7.2.2 监控与告警系统

```typescript
// 监控指标
KeyMetrics {
  // 充值相关
  dailyDepositCount: number
  dailyDepositAmount: decimal
  averageConfirmationTime: Duration
  failedDepositCount: number
  
  // 提现相关
  dailyWithdrawalCount: number
  dailyWithdrawalAmount: decimal
  pendingWithdrawalCount: number
  failedWithdrawalCount: number
  
  // 系统相关
  systemHealth: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  blockHeightLag: number       // 块高延迟
  queueDepth: number           // 队列深度
  apiResponseTime: number      // API 响应时间
}

// 告警规则
AlertRule {
  failedDepositRate > 1%
  withdrawalPendingTime > 30分钟
  blockHeightLag > 10个块
  apiResponseTime > 1000ms
  systemDown
}
```

#### 7.2.3 关键 API 端点

```
GET    /api/v1/admin/dashboard/overview
GET    /api/v1/admin/dashboard/metrics
GET    /api/v1/admin/dashboard/alerts
GET    /api/v1/admin/logs
GET    /api/v1/admin/system-status
```

### 7.3 运维部署

```dockerfile
# 主应用 Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]

# 链监听服务 Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/modules/chain/listeners/listener.service"]
```

```yaml
# Docker Compose 配置
version: '3.8'
services:
  api:
    image: wallet-api:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
      - PRIVATE_KEY_SERVICE_URL=...
    depends_on:
      - postgres
      - redis
    
  listener:
    image: wallet-listener:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=wallet
      - POSTGRES_PASSWORD=...
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 7.4 交付物
- 管理后台 API 完整实现
- 监控和告警系统
- 《运维手册》
- 《故障排查指南》
- Docker 和 Kubernetes 部署配置

---

## 八、第八阶段：测试与优化（13-14周）

### 8.1 目标
- 完成全面的测试
- 进行性能优化和压力测试
- 准备上线前的最后检查

### 8.2 测试计划

#### 8.2.1 测试覆盖

| 测试类型 | 目标 | 工作量 |
|--------|------|--------|
| 单元测试 | > 80% 代码覆盖率 | 3天 |
| 集成测试 | 关键流程端到端验证 | 4天 |
| 性能测试 | API 响应时间 < 200ms（P95）| 2天 |
| 压力测试 | 支持 1000+ 并发、10000 TPS 充值处理 | 2天 |
| 安全测试 | SQL 注入、XSS、CSRF、未授权访问 | 3天 |
| 链上测试 | 测试网全量功能验证、链重组模拟 | 3天 |
| 灾难恢复测试 | 数据库故障、缓存故障、链服务故障 | 2天 |

#### 8.2.2 性能优化目标

| 指标 | 目标 | 现状 → 优化 |
|------|------|------------|
| API 响应时间 | P95 < 200ms | - |
| 数据库查询 | P95 < 50ms | - |
| 充值确认延迟 | < 2分钟（TRON）| - |
| 系统吞吐量 | > 10000 TPS | - |
| 缓存命中率 | > 85% | - |

### 8.3 优化策略

```typescript
// 1. 数据库优化
- 创建必要的索引（userId, walletAddress, txHash, createdAt）
- 分区大表（按时间）
- SQL 查询优化和解释计划分析
- 连接池优化

// 2. 缓存优化
- Redis 用于缓存热点数据
- 缓存预热策略
- 缓存失效和更新策略

// 3. 异步处理
- 使用消息队列处理非关键路径
- 后台任务异步化
- 定时任务优化

// 4. 链交互优化
- 批量获取块数据减少 RPC 调用
- RPC 端点分布式部署
- 缓存合约 ABI 和地址信息
```

### 8.4 交付物
- 测试报告（单元、集成、性能）
- 《性能优化报告》
- 《安全审计报告》
- 优化后的代码和配置

---

## 九、第九阶段：上线准备与灰度发布（14-16周）

### 9.1 目标
- 完成上线前的所有准备
- 执行灰度发布策略
- 建立稳定的线上运营体系

### 9.2 上线前检查清单

#### 9.2.1 功能检查
- [ ] 所有核心功能已实现并测试通过
- [ ] API 接口文档完整且准确
- [ ] 错误处理和异常情况覆盖完整
- [ ] 用户指南和操作手册已准备

#### 9.2.2 性能检查
- [ ] 性能指标符合目标
- [ ] 数据库查询已优化
- [ ] 缓存策略已实施
- [ ] 监控和告警系统已就位

#### 9.2.3 安全检查
- [ ] 安全审计已完成
- [ ] 密钥管理方案已部署
- [ ] 访问控制和权限管理已配置
- [ ] 审计日志已启用

#### 9.2.4 运维检查
- [ ] CI/CD 流程已建立
- [ ] 部署流程已文档化
- [ ] 故障恢复流程已测试
- [ ] 告警和值班流程已建立
- [ ] 备份和恢复方案已测试

#### 9.2.5 业务检查
- [ ] 风控规则已配置
- [ ] 黑名单地址已导入
- [ ] 用户通知渠道已准备
- [ ] 客服支持流程已建立

### 9.3 灰度发布策略

```
第一阶段：内部测试（1周）
- 内部员工和测试用户使用
- 流量：1% 的真实用户
- 监控：关键指标每小时一次

第二阶段：小范围灰度（2-3天）
- VIP 用户试用
- 流量：5% 的真实用户
- 监控：关键指标实时监控

第三阶段：大范围灰度（3-5天）
- 全量用户上线
- 流量：100% 的真实用户
- 监控：关键指标持续监控

灰度期间回滚策略：
- 关键指标异常立即回滚
- 0 数据丢失回滚方案
- 用户补偿方案
```

### 9.4 上线后监控

```typescript
// 关键监控指标
OnlineMetrics {
  // 实时监控（1分钟汇报一次）
  currentQPS: number
  apiErrorRate: number           // 目标 < 0.1%
  avgResponseTime: number        // 目标 < 200ms
  
  // 业务监控（5分钟汇报一次）
  depositSuccessRate: number     // 目标 > 99.9%
  withdrawalSuccessRate: number
  
  // 链监控（1分钟汇报一次）
  blockHeightLag: number
  rpcLatency: number
  
  // 系统监控（1分钟汇报一次）
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  databaseConnections: number
}
```

### 9.5 交付物
- 《上线检查报告》
- 《灰度发布计划》
- 《上线后监控方案》
- 《客户文档和API文档》
- 《运维培训材料》

---

## 十、项目时间表与资源配置

### 10.1 甘特图

```
阶段一：基础架构（1-2周）    ████
阶段二：钱包地址管理（3-4周） ████
阶段三：充值系统（5-7周）     ██████
阶段四：风控与安全（7-9周）   ██████
阶段五：提现功能（9-11周）    ██████
阶段六：管理后台（11-13周）   ██████
阶段七：测试优化（13-14周）   ████
阶段八：上线准备（14-16周）   ████
```

### 10.2 团队配置

| 角色 | 数量 | 工作内容 |
|------|------|--------|
| 项目经理 | 1 | 项目管理、进度跟踪、跨部门沟通 |
| 技术主管 | 1 | 技术方案设计、架构审查、关键技术决策 |
| 高级后端工程师 | 2 | 核心模块开发、系统设计、代码审查 |
| 中级后端工程师 | 2 | 功能模块开发、单元测试编写 |
| 前端工程师 | 1 | 管理后台开发 |
| QA 工程师 | 2 | 测试计划制定、测试执行、缺陷跟踪 |
| DevOps 工程师 | 1 | 部署配置、CI/CD、监控告警 |
| 安全工程师 | 1 | 安全审计、渗透测试、密钥管理 |
| **总计** | **11人** | |

### 10.3 预算估算

| 类别 | 项目 | 成本估算 |
|------|------|---------|
| 人力成本 | 11人 × 4月 × $5000/人月 | $220,000 |
| 基础设施 | 服务器、数据库、监控 | $20,000 |
| 第三方服务 | RPC 节点、密钥管理服务 | $15,000 |
| 测试工具 | 自动化测试、性能测试工具 | $5,000 |
| 文档与培训 | 文档编写、团队培训 | $5,000 |
| **总计** | | **$265,000** |

---

## 十一、风险识别与应对

### 11.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|--------|
| 链网络不稳定 | 交易延迟、监听失效 | 中 | 使用多个 RPC 端点、自动切换 |
| 链重组（Reorg）| 交易回滚、数据不一致 | 低 | 实现重组检测和回滚机制 |
| 私钥泄露 | 资金损失、系统瘫痪 | 低 | HSM、多重签名、访问控制 |
| 性能不达标 | 用户体验差、业务受阻 | 中 | 提前做压力测试、优化策略 |

### 11.2 业务风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|--------|
| 监管变化 | 系统需改造、上线延迟 | 中 | 保持与法务部沟通、架构弹性 |
| 安全事件 | 资金损失、声誉受损 | 低 | 多层防护、保险覆盖 |
| 用户反馈差 | 用户流失、商业目标未达 | 中 | 提前做用户测试、快速迭代 |

### 11.3 管理风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|--------|
| 人员离职 | 进度延迟、知识丢失 | 中 | 知识文档、代码交接、备岗 |
| 需求变更 | 工作量增加、延期 | 中 | 需求冻结、变更流程、缓冲时间 |
| 沟通不畅 | 理解偏差、返工增加 | 中 | 定期同步、文档明确、Demo 评审 |

---

## 十二、成功指标与验收标准

### 12.1 功能指标
- ✓ 所有计划的功能点已实现
- ✓ 关键流程已通过端到端测试
- ✓ API 文档完整、准确、可执行

### 12.2 性能指标
- ✓ API 响应时间 P95 < 200ms
- ✓ 系统吞吐量 > 10000 TPS
- ✓ 充值确认延迟 < 2 分钟

### 12.3 质量指标
- ✓ 代码覆盖率 > 80%
- ✓ 生产环境缺陷率 < 1%
- ✓ 0 数据丢失事故

### 12.4 安全指标
- ✓ 安全审计无高危漏洞
- ✓ 私钥加密存储率 100%
- ✓ 操作审计覆盖 100%

### 12.5 业务指标
- ✓ 用户满意度评分 > 4.5/5.0
- ✓ 系统可用性 > 99.9%
- ✓ 风控召回率 > 99%

---

## 十三、相关文档与资源

### 13.1 需要编写的文档
- [ ] 《系统架构设计文档》
- [ ] 《数据库设计文档》
- [ ] 《API 接口文档》（Swagger）
- [ ] 《链交互技术方案》
- [ ] 《安全策略文档》
- [ ] 《运维手册》
- [ ] 《故障排查指南》
- [ ] 《用户使用指南》
- [ ] 《风控规则文档》
- [ ] 《性能优化报告》

### 13.2 技术参考资源
- **TRON**: https://developers.tron.network/
- **Ethereum**: https://ethereum.org/en/developers/
- **NestJS**: https://docs.nestjs.com/
- **Web3.js**: https://web3js.readthedocs.io/
- **PostgreSQL**: https://www.postgresql.org/docs/

### 13.3 安全参考
- OWASP Top 10
- CWE/SANS Top 25
- 区块链安全最佳实践
- NIST 密码学标准

---

## 十四、后续规划

### 14.1 第二期功能（16 周+）
- 完整的提现流程优化
- 支持更多币种（BTC、ETH、其他 ERC20）
- 支持更多链（BSC、Polygon、Arbitrum）
- 钱包内部转账功能
- 高级风控系统（机器学习风险评分）

### 14.2 第三期功能（24 周+）
- 用户自托管钱包支持
- 硬件钱包集成
- 跨链桥接功能
- DeFi 集成（借贷、质押）
- 移动端 App

### 14.3 长期优化
- 从中心化钱包向混合钱包演进
- 支持 Web3 标准（WalletConnect）
- 增强隐私和匿名性
- 自主权和去中心化程度提升

---

## 附录：快速参考

### A. 关键技术栈速查表

```typescript
后端框架: NestJS + TypeScript
ORM: TypeORM
缓存: Redis
消息队列: Bull
链交互: Web3.js / Tron Web SDK
数据库: PostgreSQL
部署: Docker / Kubernetes
监控: Prometheus + Grafana
日志: ELK Stack / Datadog
```

### B. 常用命令速查表

```bash
# 开发环境启动
npm run start:dev

# 数据库迁移
npm run typeorm migration:run

# 单元测试
npm run test

# 集成测试
npm run test:e2e

# 生产构建
npm run build

# Docker 构建
docker build -t wallet-api:latest .
```

### C. 关键配置项

```typescript
// .env 配置项示例
TRON_RPC_URL=https://api.shasta.tronprotocol.org
ETH_RPC_URL=https://sepolia.infura.io/v3/xxx
DATABASE_URL=postgresql://user:pass@localhost:5432/wallet
REDIS_URL=redis://localhost:6379
JWT_SECRET=xxx
PRIVATE_KEY_SERVICE_URL=xxx
```

---

**文档版本**: v1.0
**最后更新**: 2025年12月15日
**维护人**: 技术团队

### 2.1 用户钱包管理

#### 2.1.1 钱包地址生成
- **需求描述**：用户首次充值时，系统自动为其生成独立的充值地址
- **业务规则**：
  - 每个用户每条链拥有独立的充值地址
  - TRC20 地址格式：以 `T` 开头的 Base58 编码地址
  - ERC20 地址格式：以 `0x` 开头的 42 位十六进制地址
  - 地址与用户账户永久绑定
  - 支持用户查看自己的充值地址和二维码

#### 2.1.2 钱包地址管理
- 地址状态管理（启用/禁用）
- 地址使用记录追踪
- 地址余额查询（仅用于监控，不作为账户余额）

### 2.2 充值功能

#### 2.2.1 充值地址展示
- 用户可查看不同链的充值地址
- 显示充值地址二维码
- 明确提示支持的代币和链
- 显示最小充值金额
- 显示预计到账时间和所需确认数

#### 2.2.2 链上充值监控
- **TRC20 监控**：
  - 实时监听 TRON 网络上的 USDT 转账事件
  - 监控用户充值地址的入账交易
  - 识别交易哈希、发送方、金额、时间戳
  
- **ERC20 监控**：
  - 实时监听 Ethereum 网络上的 USDT 转账事件
  - 监控用户充值地址的入账交易
  - 识别交易哈希、发送方、金额、时间戳、Gas 费用

#### 2.2.3 交易确认机制
- **TRC20 确认**：
  - 需要 19 个区块确认（约 57 秒）
  - 临时到账：1 个确认后显示充值记录（待确认状态）
  - 最终到账：19 个确认后资金可用
  
- **ERC20 确认**：
  - 需要 12 个区块确认（约 2.4 分钟）
  - 临时到账：1 个确认后显示充值记录（待确认状态）
  - 最终到账：12 个确认后资金可用

#### 2.2.4 充值到账处理
- 验证交易有效性（是否为 USDT 合约地址）
- 计算实际到账金额
- 更新用户账户余额
- 生成充值记录
- 发送充值成功通知

#### 2.2.5 充值记录
- 记录每笔充值的详细信息：
  - 交易哈希
  - 链类型（TRC20/ERC20）
  - 充值地址
  - 发送方地址
  - 充值金额
  - 确认数
  - 交易状态（待确认/已确认/失败）
  - 到账时间
  - 区块高度

### 2.3 账户余额管理

#### 2.3.1 余额更新
- 充值确认后实时更新用户余额
- 支持余额变动通知
- 余额变动日志记录

#### 2.3.2 余额查询
- 用户可查询当前可用余额
- 查询充值中的待确认金额
- 查询历史充值记录

### 2.4 通知功能

#### 2.4.1 充值通知
- 充值交易检测到时发送通知
- 充值到账时发送通知
- 支持多种通知渠道（站内信、邮件、短信、推送）

---

## 3. 安全需求

### 3.1 私钥安全

#### 3.1.1 密钥生成
- 使用安全的随机数生成器生成私钥
- 私钥生成环境需在安全隔离的服务器
- 使用 HSM（硬件安全模块）或 KMS（密钥管理服务）

#### 3.1.2 密钥存储
- **冷热钱包分离**：
  - 热钱包：存储少量资金用于日常提现（未来功能）
  - 冷钱包：存储大部分用户资金，离线保管
- 私钥加密存储，采用多重加密
- 使用信封加密（Envelope Encryption）
- 主密钥（MEK）由 KMS 管理
- 数据密钥（DEK）加密实际私钥

#### 3.1.3 密钥使用
- 私钥仅在必要时加载到内存
- 使用完毕立即清除内存
- 操作审计日志完整记录

### 3.2 资金安全

#### 3.2.1 充值风控
- 识别异常大额充值
- 检测高频充值行为
- 黑名单地址拦截
- 可疑交易人工审核

#### 3.2.2 地址安全
- 定期检查地址余额，及时归集到冷钱包
- 异常转出实时告警
- 地址私钥定期轮换机制（可选）

#### 3.2.3 资金归集策略
- 热钱包余额达到阈值时自动归集到冷钱包
- 归集操作需多重签名
- 归集记录完整审计

### 3.3 系统安全

#### 3.3.1 访问控制
- API 接口认证和授权
- 基于角色的权限控制（RBAC）
- 敏感操作需要二次验证

#### 3.3.2 数据安全
- 敏感数据加密存储
- 数据库访问审计
- 定期数据备份
- 数据脱敏处理（日志中不显示完整地址和金额）

#### 3.3.3 网络安全
- 服务器部署在私有网络
- 使用防火墙限制访问
- API 网关限流和防护
- DDoS 防护

### 3.4 合规性

#### 3.4.1 KYC/AML
- 用户实名认证
- 大额交易报告
- 可疑交易监控
- 配合监管机构调查

---

## 4. 性能需求

### 4.1 交易处理能力
- 支持每秒处理 1000+ 充值监控请求
- 充值到账延迟 < 1 分钟（区块确认后）
- 系统响应时间 < 200ms

### 4.2 并发能力
- 支持 10,000+ 用户同时在线
- 支持 1,000+ 并发 API 请求

### 4.3 可用性
- 系统可用性 99.9%+
- 支持主备切换，故障恢复时间 < 5 分钟

---

## 5. 技术需求

### 5.1 区块链节点
- 自建 TRON 全节点或使用可靠的第三方服务
- 自建 Ethereum 全节点或使用可靠的第三方服务
- 节点高可用部署，至少 2 个节点互为备份

### 5.2 数据库
- 使用关系型数据库（PostgreSQL/MySQL）存储用户数据
- 使用 Redis 缓存热点数据
- 数据库主从部署，支持读写分离

### 5.3 监控告警
- 系统监控（CPU、内存、磁盘、网络）
- 业务监控（充值成功率、到账延迟）
- 安全监控（异常登录、异常转账）
- 告警及时推送（邮件、短信、钉钉/企业微信）

---

## 6. 非功能性需求

### 6.1 可扩展性
- 架构支持横向扩展
- 支持未来添加新的区块链网络
- 支持添加新的代币

### 6.2 可维护性
- 代码规范，注释完整
- 完善的日志记录
- 清晰的错误处理
- 单元测试覆盖率 > 80%

### 6.3 可审计性
- 所有关键操作记录审计日志
- 日志不可篡改
- 日志保留至少 3 年

---

## 7. 交付物

### 7.1 系统组件
- 钱包服务（Wallet Service）
- 充值监控服务（Deposit Monitor Service）
- 通知服务（Notification Service）
- 管理后台（Admin Dashboard）
- 用户 API（User API）

### 7.2 文档
- 需求文档（本文档）
- 开发计划文档
- 安全设计文档
- 技术架构文档
- API 接口文档
- 部署运维文档
- 用户操作手册

---

## 8. 风险评估

### 8.1 技术风险
- **区块链节点稳定性**：依赖第三方节点可能存在服务中断风险
  - 缓解措施：自建节点 + 多个第三方节点备份
  
- **重放攻击**：同一笔交易被重复处理
  - 缓解措施：交易哈希去重，幂等性设计

### 8.2 安全风险
- **私钥泄露**：可能导致资金被盗
  - 缓解措施：冷热钱包分离、加密存储、访问控制、定期审计
  
- **内部人员作恶**：拥有系统权限的人员恶意操作
  - 缓解措施：权限最小化、操作审计、多人审批、定期审计

### 8.3 业务风险
- **充值未到账**：用户充值但系统未检测到
  - 缓解措施：监控告警、人工补单机制
  
- **错误到账**：将充值记录到错误账户
  - 缓解措施：严格的地址验证、交易记录审计

---

## 9. 成功标准

### 9.1 功能完整性
- ✅ 用户可成功生成充值地址
- ✅ 系统能准确监控链上充值交易
- ✅ 充值能正确到账用户账户
- ✅ 充值记录完整准确

### 9.2 性能指标
- ✅ 充值到账延迟 < 1 分钟（确认后）
- ✅ API 响应时间 < 200ms
- ✅ 系统可用性 > 99.9%

### 9.3 安全指标
- ✅ 无私钥泄露事件
- ✅ 无资金被盗事件
- ✅ 无重大安全漏洞

---

## 10. 附录

### 10.1 相关资源
- TRON 官方文档：https://developers.tron.network/
- Ethereum 官方文档：https://ethereum.org/developers
- USDT（TRC20）合约地址：TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
- USDT（ERC20）合约地址：0xdAC17F958D2ee523a2206206994597C13D831ec7

### 10.2 术语表
- **冷钱包**：离线存储私钥的钱包，安全性高
- **热钱包**：在线存储私钥的钱包，便于操作但安全性相对较低
- **KMS**：Key Management Service，密钥管理服务
- **HSM**：Hardware Security Module，硬件安全模块
- **RBAC**：Role-Based Access Control，基于角色的访问控制
- **幂等性**：同一操作执行多次与执行一次效果相同

---

**文档版本**：v1.0  
**创建日期**：2025-12-12  
**文档状态**：待评审
