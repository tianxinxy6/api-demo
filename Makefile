.PHONY: help install build dev test lint clean docker-up docker-down migrate

# 变量定义
NODE_ENV ?= development
APP_PORT ?= 3000

# 颜色定义
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m

help: ## 显示帮助信息
	@echo "$(BLUE)可用命令:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

install: ## 安装依赖
	@echo "$(BLUE)安装 npm 依赖...$(NC)"
	npm install

build: ## 构建应用
	@echo "$(BLUE)构建应用...$(NC)"
	npm run build
	@echo "$(GREEN)✓ 构建完成$(NC)"

dev: ## 启动开发服务器
	@echo "$(BLUE)启动开发服务器 (端口: $(APP_PORT))...$(NC)"
	npm run start:dev

prod: ## 启动生产服务器
	@echo "$(BLUE)启动生产服务器...$(NC)"
	npm run start:prod

test: ## 运行单元测试
	@echo "$(BLUE)运行单元测试...$(NC)"
	npm run test

test:watch: ## 运行单元测试（监听模式）
	@echo "$(BLUE)运行单元测试（监听模式）...$(NC)"
	npm run test:watch

test:e2e: ## 运行端到端测试
	@echo "$(BLUE)运行端到端测试...$(NC)"
	npm run test:e2e

test:cov: ## 生成测试覆盖率报告
	@echo "$(BLUE)生成测试覆盖率报告...$(NC)"
	npm run test:cov

lint: ## 运行代码检查
	@echo "$(BLUE)运行代码检查...$(NC)"
	npm run lint

lint:fix: ## 修复代码风格问题
	@echo "$(BLUE)修复代码风格问题...$(NC)"
	npm run lint:fix

format: ## 格式化代码
	@echo "$(BLUE)格式化代码...$(NC)"
	npm run format

typecheck: ## TypeScript 类型检查
	@echo "$(BLUE)TypeScript 类型检查...$(NC)"
	npx tsc --noEmit

docker:build: ## 构建 Docker 镜像
	@echo "$(BLUE)构建 Docker 镜像...$(NC)"
	docker build -t wallet-api:latest .
	@echo "$(GREEN)✓ 镜像构建完成$(NC)"

docker:up: ## 启动 Docker Compose 服务
	@echo "$(BLUE)启动 Docker Compose 服务...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ 服务已启动$(NC)"
	@echo "$(YELLOW)等待服务就绪...$(NC)"
	@sleep 5
	@echo "$(BLUE)服务状态:$(NC)"
	@docker-compose ps

docker:down: ## 停止 Docker Compose 服务
	@echo "$(BLUE)停止 Docker Compose 服务...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ 服务已停止$(NC)"

docker:logs: ## 查看 Docker 日志
	docker-compose logs -f

docker:ps: ## 查看 Docker 运行状态
	docker-compose ps

db:migrate: ## 运行数据库迁移
	@echo "$(BLUE)运行数据库迁移...$(NC)"
	npm run typeorm migration:run
	@echo "$(GREEN)✓ 迁移完成$(NC)"

db:revert: ## 回滚上一个数据库迁移
	@echo "$(BLUE)回滚数据库迁移...$(NC)"
	npm run typeorm migration:revert

db:generate: ## 生成数据库迁移
	@echo "$(BLUE)生成新的迁移文件...$(NC)"
	@read -p "迁移名称: " name; \
	npm run typeorm migration:create src/migrations/$$name

db:show: ## 查看迁移状态
	@echo "$(BLUE)迁移状态:$(NC)"
	npm run typeorm migration:show

db:seed: ## 运行数据库种子数据
	@echo "$(BLUE)运行种子数据...$(NC)"
	npm run typeorm migration:run -- --seed

health: ## 检查应用健康状态
	@echo "$(BLUE)检查应用健康状态...$(NC)"
	@curl -s http://localhost:$(APP_PORT)/health | jq . || echo "$(RED)应用不可用$(NC)"

clean: ## 清理构建输出和依赖
	@echo "$(BLUE)清理文件...$(NC)"
	rm -rf dist/
	rm -rf coverage/
	rm -rf node_modules/
	@echo "$(GREEN)✓ 清理完成$(NC)"

clean:deps: ## 只清理 node_modules
	@echo "$(BLUE)清理 node_modules...$(NC)"
	rm -rf node_modules/
	rm package-lock.json
	@echo "$(GREEN)✓ 清理完成$(NC)"

setup: install docker:up db:migrate build ## 完整设置（安装、启动数据库、迁移、构建）
	@echo "$(GREEN)✓ 设置完成！$(NC)"
	@echo ""
	@echo "$(BLUE)下一步:$(NC)"
	@echo "  运行开发服务器: make dev"
	@echo "  或: npm run start:dev"

audit: ## 检查依赖安全性
	@echo "$(BLUE)检查依赖安全性...$(NC)"
	npm audit

outdated: ## 检查过时的依赖
	@echo "$(BLUE)检查过时的依赖...$(NC)"
	npm outdated

update: ## 更新依赖
	@echo "$(BLUE)更新依赖...$(NC)"
	npm update

size: ## 计算项目大小
	@echo "$(BLUE)项目大小统计:$(NC)"
	@du -sh . | xargs echo "总大小:"
	@du -sh dist/ | xargs echo "构建输出:"
	@du -sh node_modules/ | xargs echo "依赖大小:"

lines: ## 统计代码行数
	@echo "$(BLUE)代码统计:$(NC)"
	@find src -name "*.ts" ! -path "*/node_modules/*" | xargs wc -l | tail -1 | awk '{print "TypeScript 行数: " $$1}'
	@find src -name "*.ts" -type f | xargs grep -l "describe\|it\(" | xargs wc -l | tail -1 | awk '{print "测试代码行数: " $$1}'

docs: ## 生成 API 文档
	@echo "$(BLUE)API 文档已在:$(NC)"
	@echo "  http://localhost:$(APP_PORT)/api/docs"

all: clean install build test lint ## 完整构建流程（清理、安装、构建、测试、检查）
	@echo "$(GREEN)✓ 完整构建成功！$(NC)"

.DEFAULT_GOAL := help
