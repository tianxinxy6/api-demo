import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { SysModule } from '../sys/sys.module';

@Module({
  controllers: [TestController],
  imports: [SysModule],
})
export class TestModule {}
