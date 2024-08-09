import { Redis } from 'ioredis';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@Common';

@Module({})
export class QueueModule {
  static registerAsync(name: string): DynamicModule {
    return BullModule.registerQueueAsync({
      name,
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ) => ({
        connection: new Redis(configService.get('REDIS_URI'), {
          maxRetriesPerRequest: null,
        }),
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: true,
        },
      }),
      inject: [ConfigService],
    });
  }
}
