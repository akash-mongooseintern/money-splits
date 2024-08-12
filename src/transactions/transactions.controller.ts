import { AccessGuard, AuthenticatedRequest, BaseController, JwtAuthGuard } from "@Common";
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiResponse, ApiTags } from "@nestjs/swagger";
import { TransactionsService } from "./transactions.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { SuccessResponseDto } from "../common/dto/success-response.dto";
import { QuickSplitsDto } from "./dto/quick-splits.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('transactions')
export class TransactionsController extends BaseController {

    constructor(
        private readonly transactionsService: TransactionsService
    ) {
        super()
    }

    @ApiOkResponse({
        type: Promise<SuccessResponseDto<any>>,
        description: "It will return splits and settlement of transaction by transaction id"
    })
    @Get(':transaction_id/settlements')
    async getTransactionSplitsByTxnId(
        @Param('transaction_id') txnId: number
    ) : Promise<SuccessResponseDto<string[]>> {
        return new SuccessResponseDto(await this.transactionsService.getTransactionSplitsByTxnId(txnId))
    }

    @ApiCreatedResponse({
        type: Promise<{ status: string }>
    })
    @Post()
    async createTransactionsMany(
        @Body() createTransactionDto: CreateTransactionDto[]
    ) : Promise<{ status: string }> {
        return await this.transactionsService.createManyTransaction(createTransactionDto)
    }

    @ApiCreatedResponse({
        type: SuccessResponseDto<{ result : string }>
    })
    @Post('quick-money-splits')
    getQuickSplits(
        @Body() quickSplitsDto: QuickSplitsDto
    ) : SuccessResponseDto<{ result : string }> {
        return new SuccessResponseDto(this.transactionsService.getQuickSplits(quickSplitsDto))
    }

    @ApiResponse({
        type: Promise<{ status: string }>
    })
    @Put(':transaction_id')
    async updateTransactionById(
        @Param('transaction_id',ParseIntPipe) txnId: number,
        @Body() updateTransactionDto: UpdateTransactionDto
    ) : Promise<{ status: string }> {
        return await this.transactionsService.updateTransactionById(txnId, updateTransactionDto)
    } 

    @ApiResponse({
        type: Promise<{ status: string }>
    })
    @Delete('person/:transaction_id')
    async deletePersonFromTransactionById(
        @Req() req: AuthenticatedRequest,
        @Param('transaction_id',ParseIntPipe) txnId: number
    ) : Promise<{ status: string}> {
        const ctx = this.getContext(req)
        return await this.transactionsService.deletePersonFromTransactionById(txnId, ctx.user.id)
    }
    
    @ApiResponse({
        type: Promise<{ status: string }>
    })
    @Delete(':transaction_id')
    async deleteTransactionsById(
        @Req() req: AuthenticatedRequest,
        @Param('transaction_id',ParseIntPipe) txnId: number
    ) : Promise<{ status: string}> {
        const ctx = this.getContext(req)
        return await this.transactionsService.deleteTransactionsById(txnId, ctx.user.id)
    }
}