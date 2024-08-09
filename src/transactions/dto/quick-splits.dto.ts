import { ApiProperty } from "@nestjs/swagger"
import { IsNumber } from "class-validator"

export class QuickSplitsDto {
    @ApiProperty()
    @IsNumber()
    totalPerson: number
    
    @ApiProperty()
    @IsNumber()
    amount: number
}