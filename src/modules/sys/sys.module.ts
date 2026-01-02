import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenEntity } from '@/entities/token.entity';
import { TokenPriceEntity } from '@/entities/token-price.entity';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { SharedModule } from '@/shared/shared.module';
import { TokenService } from './services/token.service';
import { TokenPriceService } from './services/token-price.service';
import { SysWalletAddressService } from './services/sys-wallet.service';

const services = [TokenService, TokenPriceService, SysWalletAddressService];

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenEntity, TokenPriceEntity, SysWalletAddressEntity]),
    SharedModule,
  ],
  providers: services,
  exports: services,
})
export class SysModule {}