import { Injectable, BadRequestException } from '@nestjs/common';
import { AddressInfo, ChainType } from '@/constants';
import { EthUtil } from '@/utils/eth.util';
import { TronUtil } from '@/utils/tron.util';

/**
 * 钱包地址生成服务
 * 
 * 提供统一的钱包地址生成接口，支持多种区块链类型
 */
@Injectable()
export class WalletService {
    /**
     * 根据链类型生成钱包地址
     * @param chainType 区块链类型
     * @returns 地址信息（包含私钥、公钥、地址）
     */
    async generateWallet(chainType: ChainType): Promise<AddressInfo> {
        switch (chainType) {
            case ChainType.ETH:
                return EthUtil.generate();
            case ChainType.TRON:
                return await TronUtil.generate();
            default:
                throw new BadRequestException(`Unsupported chain type: ${chainType}`);
        }
    }
}
