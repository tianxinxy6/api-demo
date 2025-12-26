# 多阶段构建 - 生产镜像
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 build 依赖
RUN apk add --no-cache python3 make g++

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 安装 dumb-init 用于优雅地处理信号
RUN apk add --no-cache dumb-init

# 安装生产依赖
RUN apk add --no-cache curl

# 非 root 用户
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# 从 builder 阶段复制 node_modules
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# 从 builder 阶段复制构建产物
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# 复制 package 文件
COPY --chown=nodejs:nodejs package*.json ./

# 切换到 nodejs 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/main.js"]
