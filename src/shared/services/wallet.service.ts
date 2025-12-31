import { Injectable, Logger } from '@nestjs/common';
import { AddressInfo, ChainType, ErrorCode } from '@/constants';
import { EthUtil } from '@/utils/eth.util';
import { TronUtil } from '@/utils/tron.util';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * 钱包地址生成服务
 * 职责：
 * 1. 提供统一的钱包地址生成接口
 * 2. 支持多种区块链类型（ETH、TRON）
 */
@Injectable()
export class WalletService {
    private readonly logger = new Logger(WalletService.name);

    /**
     * 根据链类型生成钱包地址
     * @param chainType 区块链类型
     * @returns 地址信息（包含私钥、公钥、地址）
     */
    async generateWallet(chainType: ChainType): Promise<AddressInfo> {
        try {
            switch (chainType) {
                case ChainType.ETH:
                    return EthUtil.generate();
                case ChainType.TRON:
                    return await TronUtil.generate();
                default:
                    this.logger.warn(`Unsupported chain type: ${chainType}`);
                    throw new BusinessException(ErrorCode.ErrSharedChainTypeNotSupported);
            }
        } catch (error) {
            if (error instanceof BusinessException) {
                throw error;
            }
            this.logger.error(`Failed to generate wallet for chain type ${chainType}: ${error.message}`);
            throw error;
        }
    }
}
