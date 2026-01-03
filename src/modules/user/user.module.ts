import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '@/entities/user.entity';
import { UserWalletEntity } from '@/entities/user-wallet.entity';
import { UserWalletLogEntity } from '@/entities/user-wallet-log.entity';
import { UserWalletAddressEntity } from '@/entities/user-wallet-address.entity';
import { UserService } from './services/user.service';
import { WalletService } from './services/wallet.service';
import { ChainAddressService } from './services/chain-address.service';
import { UserController } from './controllers/user.controller';
import { AppCacheModule } from '@/shared/cache/cache.module';
import { WalletController } from './controllers/wallet.controller';
import { SharedModule } from '@/shared/shared.module';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { SysModule } from '@/modules/sys/sys.module';

const providers = [UserService, WalletService, ChainAddressService, TokenBlacklistService];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserWalletEntity,
      UserWalletLogEntity,
      UserWalletAddressEntity,
    ]),
    AppCacheModule,
    SharedModule,
    SysModule,
  ],
  controllers: [UserController, WalletController],
  providers: [...providers],
  exports: [...providers],
})
export class UserModule {}
