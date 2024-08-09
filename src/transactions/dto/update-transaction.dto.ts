import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";

export class UpdateTransactionDto {
    @ApiProperty()
    @IsNumber()
    amount: number;
}