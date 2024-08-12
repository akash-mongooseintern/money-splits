import { Module } from "@nestjs/common";
import { TransactionsController } from "./transactions.controller";
import { PrismaService } from "../prisma";
import { TransactionsService } from "./transactions.service";
import { SettlementsModule } from "../settlements/settlements.module";

@Module({
    imports: [SettlementsModule],
    controllers: [TransactionsController],
    providers: [
        PrismaService,
        TransactionsService,
    ],
})
export class TransactionsModule {}