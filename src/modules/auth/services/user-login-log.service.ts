import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLoginLogEntity } from '@/entities/user-login-log.entity';
import type { FastifyRequest } from 'fastify';
import { getClientIp } from '@/utils';

@Injectable()
export class UserLoginLogService {
  private readonly logger = new Logger(UserLoginLogService.name);

  constructor(
    @InjectRepository(UserLoginLogEntity)
    private readonly userLoginLogRepository: Repository<UserLoginLogEntity>,
  ) {}

  /**
   * 记录用户登录日志
   */
  async recordLoginLog(
    userId: number,
    request: FastifyRequest,
    status: number = 1,
    failureReason?: string,
  ): Promise<UserLoginLogEntity> {
    const userAgent = request.headers['user-agent'] || '';
    const loginIp = getClientIp(request);
    
    // 解析用户代理信息
    const deviceInfo = this.parseUserAgent(userAgent);

    const loginLog = this.userLoginLogRepository.create({
      userId,
      loginIp,
      userAgent,
      deviceType: deviceInfo.deviceType,
      platform: deviceInfo.platform,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      status,
      failureReason: failureReason || '',
      location: '', // 可以后续集成IP地址库获取地理位置
    });

    return await this.userLoginLogRepository.save(loginLog);
  }

  /**
   * 简单解析用户代理信息
   */
  private parseUserAgent(userAgent: string) {
    const deviceInfo = {
      deviceType: 'unknown',
      platform: 'unknown',
      browser: 'unknown',
      os: 'unknown',
    };

    if (!userAgent) {
      return deviceInfo;
    }

    const ua = userAgent.toLowerCase();

    // 检测设备类型
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      deviceInfo.deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceInfo.deviceType = 'tablet';
    } else {
      deviceInfo.deviceType = 'desktop';
    }

    // 检测操作系统
    if (ua.includes('windows')) {
      deviceInfo.os = 'Windows';
    } else if (ua.includes('mac')) {
      deviceInfo.os = 'macOS';
    } else if (ua.includes('linux')) {
      deviceInfo.os = 'Linux';
    } else if (ua.includes('android')) {
      deviceInfo.os = 'Android';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      deviceInfo.os = 'iOS';
    }

    // 检测浏览器
    if (ua.includes('chrome') && !ua.includes('edg')) {
      deviceInfo.browser = 'Chrome';
    } else if (ua.includes('firefox')) {
      deviceInfo.browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      deviceInfo.browser = 'Safari';
    } else if (ua.includes('edg')) {
      deviceInfo.browser = 'Edge';
    } else if (ua.includes('opera')) {
      deviceInfo.browser = 'Opera';
    }

    // 检测平台
    if (ua.includes('android')) {
      deviceInfo.platform = 'Android';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      deviceInfo.platform = 'iOS';
    } else if (ua.includes('windows')) {
      deviceInfo.platform = 'Windows';
    } else if (ua.includes('mac')) {
      deviceInfo.platform = 'macOS';
    } else if (ua.includes('linux')) {
      deviceInfo.platform = 'Linux';
    }

    return deviceInfo;
  }
}