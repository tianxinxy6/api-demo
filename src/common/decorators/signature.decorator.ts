import { SetMetadata } from '@nestjs/common';
import { SKIP_SIGNATURE_KEY } from '@/common/guards/signature.guard';

/**
 * 跳过签名验证
 * 
 * 用于公开接口：登录、注册、查询等不需要签名的接口
 * 
 * @example
 * // 单个方法
 * @Post('login')
 * @SkipSignature()
 * async login(@Body() dto: LoginDto) { }
 * 
 * // 整个 Controller（所有公开接口）
 * @Controller('public')
 * @SkipSignature()
 * export class PublicController { }
 * 
 * @example
 * // 客户端使用（需要签名的接口）
 * import { SignatureUtil } from '@/utils/signature.util';
 * 
 * const { signature, timestamp, nonce } = SignatureUtil.generate(
 *   'your-secret-key',
 *   { amount: 100, toAddress: '0x123...' }
 * );
 * 
 * fetch('/api/wallet/transfer', {
 *   method: 'POST',
 *   headers: {
 *     'x-signature': signature,
 *     'x-timestamp': timestamp.toString(),
 *     'x-nonce': nonce,
 *   },
 *   body: JSON.stringify({ amount: 100, toAddress: '0x123...' }),
 * });
 */
export const SkipSignature = () => SetMetadata(SKIP_SIGNATURE_KEY, true);
