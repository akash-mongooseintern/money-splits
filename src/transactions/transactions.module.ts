import { Module } from "@nestjs/common";
import { TransactionsController } from "./transactions.controller";
import { PrismaService } from "../prisma";
import { TransactionsService } from "./transactions.service";

@Module({
    controllers: [TransactionsController],
    providers: [
        PrismaService,
        TransactionsService
    ]
})
export class TransactionsModule {}