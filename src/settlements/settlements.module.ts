import { Module } from "@nestjs/common";
import { SettlementsService } from "./settlements.service";
import { PrismaService } from "../prisma";
import { SettlementsController } from "./settlements.controller";

@Module({
    controllers: [SettlementsController],
    providers: [
        SettlementsService,
        PrismaService
    ],
    exports: [SettlementsService]
})
export class SettlementsModule{}