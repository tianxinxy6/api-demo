import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isEmpty } from 'lodash';
import { ExtractJwt } from 'passport-jwt';

import { BusinessException } from '@/common/exceptions/biz.exception';
import { AuthStrategy, PUBLIC_KEY } from '../auth.constant';
import { TokenBlacklistService } from '@/modules/auth/services/token-blacklist.service';
import { ErrorCode } from '@/constants/error-code.constant';

// https://docs.nestjs.com/recipes/passport#implement-protected-route-and-jwt-strategy-guards
@Injectable()
export class JwtAuthGuard extends AuthGuard(AuthStrategy.JWT) {
  jwtFromRequestFn = ExtractJwt.fromAuthHeaderAsBearerToken();

  constructor(
    private reflector: Reflector,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<any> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();

    const token = this.jwtFromRequestFn(request);
    request.accessToken = token;

    // 如果是公开路由，直接返回
    if (isPublic) {
      request.user = null;
      return true;
    }

    // 非公开路由必须携带有效的 token
    if (isEmpty(token)) {
      throw new UnauthorizedException('请先登录');
    }

    // 检查 Token 是否有效（包含黑名单和批量撤销检查）
    const isValidToken = await this.tokenBlacklistService.isTokenValid(token);
    if (!isValidToken) {
      throw new UnauthorizedException('Token 已失效，请重新登录');
    }

    // 通过 Passport JWT 策略进行验证
    let result: any = false;
    try {
      result = await super.canActivate(context);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw new BusinessException(ErrorCode.ErrToken);
      }
      throw err;
    }

    // super.canActivate 成功后，用户信息已经通过 JWT 策略的 validate 方法设置到 request.user 中
    // 无需再次调用 tokenService.verify 验证
    return result;
  }

  override handleRequest(err, user) {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) throw err || new UnauthorizedException();

    return user;
  }
}
