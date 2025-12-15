import {
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isEmpty } from 'lodash';
import { ExtractJwt } from 'passport-jwt';

import { BusinessException } from '@/common/exceptions/biz.exception';
import { AuthStrategy, PUBLIC_KEY } from '../auth.constant';
import { TokenService } from '../services/token.service';
import appConfig from '@/config/app.config';
import { ErrorCode } from '@/constants/error-code.constant';

// https://docs.nestjs.com/recipes/passport#implement-protected-route-and-jwt-strategy-guards
@Injectable()
export class JwtAuthGuard extends AuthGuard(AuthStrategy.JWT) {
  jwtFromRequestFn = ExtractJwt.fromAuthHeaderAsBearerToken();

  constructor(
    private reflector: Reflector,
    private tokenService: TokenService,
    @Inject('APP_CONFIG') private appConfig,
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

    let result: any = false;
    try {
      result = await super.canActivate(context);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw new BusinessException(ErrorCode.ErrToken);
      }
      throw err;
    }

    // 验证 token 有效性
    const user: IAuthUser | null = await this.tokenService.verify(token);
    if (!user) {
      throw new BusinessException(ErrorCode.ErrInvalidToken);
    }

    request.user = user;
    return result;
  }

  handleRequest(err, user) {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) throw err || new UnauthorizedException();

    return user;
  }
}
