import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenEntity } from '@/entities/token.entity';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { SharedModule } from '@/shared/shared.module';
import { TokenService } from './services/token.service';
import { SysWalletAddressService } from './services/sys-wallet.service';
import { SysWalletController } from './controllers/sys-wallet.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenEntity, SysWalletAddressEntity]),
    SharedModule,
  ],
  controllers: [SysWalletController],
  providers: [TokenService, SysWalletAddressService],
  exports: [TokenService, SysWalletAddressService],
})
export class SysModule {}