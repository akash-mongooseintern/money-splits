import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsNumber } from "class-validator";

export class CreateTransactionDto {
    @ApiProperty()
    @IsNumber()
    amount: number;
    
    @ApiProperty({
        description: 'List of users id who will pay money'
    })
    @IsArray({
        message: 'List of users id who will pay money'
    })
    userId: string

}