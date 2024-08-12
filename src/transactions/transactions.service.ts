import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { ICreateTransaction, IGetTransactionSplitsByTxnId, ISettlementArray, ITransactionDataToCalculateSplit } from "./transactions.interface";
import { Transactions } from "@prisma/client";
import { QuickSplitsDto } from "./dto/quick-splits.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { SettlementsService } from "../settlements/settlements.service";
import { ICreateSettlements } from "../settlements/settlements.interface";

@Injectable()
export class TransactionsService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly settlementsService: SettlementsService
    ) { }

    async findUniqueTransactionById(id: number): Promise<Transactions | null> {
        return await this.prismaService.transactions.findUnique({ where: { id } })
    }

    async getTransactionSplitsByTxnId(
        txnId: number
    ): Promise<string[]> {
        const txn = await this.findUniqueTransactionById(txnId)
        let parentTransactionId: number;
        if (txn) {
            parentTransactionId = txn.parentTransactionId ?? txn.id
        } else {
            throw new Error('Invalid transaction ID!')
        }
        const queryResult = await this.prismaService.settlements.findMany({
            where: {
                transactionId: parentTransactionId
            },
            select: {
                amount: true,
                lender: {
                    select: {
                        firstname: true,
                        lastname: true,
                    }
                },
                borrower: {
                    select: {
                        firstname: true,
                        lastname: true,
                    }
                }
            }
        })
        return queryResult.map(item => `${item.borrower.firstname} ${item.borrower.lastname} will pay ${item.amount.toFixed(2)} rupee to ${item.lender.firstname} ${item.lender.lastname}`)
    }

    async calculateSplitsAndUpdateOrCreateSettlements(
        totalAmount: number,
        txnId: number,
        createTransactionDto: CreateTransactionDto[],
        isCreateSettlements?: boolean
    ) : Promise<void> {
            const meanAmount = totalAmount/createTransactionDto.length
            const settlementArr: ISettlementArray = {
                lender: [],
                borrower: []
            }
            createTransactionDto.map((item) => {
                if (meanAmount > item.amount) {
                    settlementArr.borrower.push({
                        amount: item.amount,
                        userId: item.userId
                    })
                } else {
                    settlementArr.lender.push({
                        amount: item.amount,
                        userId: item.userId
                    })
                }
            })
            const { lender, borrower } = settlementArr
            let borrowerIndex = 0;
            let lenderIndex = 0;
            let createOrUpdateSettlements : ICreateSettlements[] = []
            while (borrowerIndex < borrower.length && lenderIndex < lender.length) {
                if (borrower[borrowerIndex].amount === meanAmount) {
                    borrowerIndex++
                    continue
                }
                if (lender[lenderIndex].amount === meanAmount) {
                    lenderIndex++
                    continue
                }
                const payment = Math.min(meanAmount - borrower[borrowerIndex].amount, lender[lenderIndex].amount - meanAmount)
                borrower[borrowerIndex].amount += payment
                lender[lenderIndex].amount -= payment
                const settlementData = {
                    transactionId: txnId,
                    amount: borrower[borrowerIndex].amount,
                    borrowerId: borrower[borrowerIndex].userId,
                    lenderId: lender[lenderIndex].userId
                }
                if(isCreateSettlements){
                    createOrUpdateSettlements.push(settlementData)
                }else{
                    await this.settlementsService.updateSettlement(settlementData)
                }
            }
            if(isCreateSettlements){
                await this.settlementsService.createManySettlements(createOrUpdateSettlements)
            }
    }

    private async createTransaction(
        txnData: ICreateTransaction,
        userId: string,
        index: number
    ): Promise<Transactions> {
        const result = await this.prismaService.transactions.create({
            data: txnData,
        })
        if (!result) {
            throw new Error('Something went wrong!')
        }
        if (!index) {
            txnData.parentTransactionId = result.id
        }
        await this.prismaService.transactionUserRelation.create({
            data: {
                userId: userId,
                transactionId: result.id
            }
        })
        return result
    }

    async createManyTransaction(
        createTransactionDto: CreateTransactionDto[],
    ): Promise<{ status: string }> {
        return await this.prismaService.$transaction(async () => {
            const txnData: ICreateTransaction = {
                amount: 0
            }
            let totalAmount = 0
            for (let i = 0; i < createTransactionDto.length; i++) {
                totalAmount += createTransactionDto[i].amount
                txnData.amount = createTransactionDto[i].amount
                await this.createTransaction(txnData, createTransactionDto[i].userId, i)
            }
            if(!txnData.parentTransactionId) throw new Error('Transaction ID is missing!')
            await this.prismaService.transactionMeta.create({
                data: {
                    transactionId: txnData.parentTransactionId,
                    amount: totalAmount,
                    totalPerson: createTransactionDto.length,
                }
            })
            await this.calculateSplitsAndUpdateOrCreateSettlements(
                totalAmount,
                txnData.parentTransactionId,
                createTransactionDto,
                true
            )
        }).then(() => {
            return {
                status: 'success!'
            }
        }).catch((err) => {
            console.log(err)
            return {
                status: 'failed!'
            }
        })
    }

    getQuickSplits(
        quickSplitsDto: QuickSplitsDto
    ) : {
        result: string
    } {
        const { amount, totalPerson } = quickSplitsDto
        return {
            result : `Each person will share ${(amount / totalPerson).toFixed(2)} rupees`
        }
    }

    async deletePersonFromTransactionById(txnId: number, userId: any): Promise<{ status: string}> {
        return await this.prismaService.$transaction( async (txn) =>{
            const result = await this.prismaService.transactions.findUnique({
                where: {
                    id: txnId
                },
                include: {
                    transactionUserRelation: true
                }
            })
            if(!result) throw new Error('Record not found!')
            const txnUsrRel = result.transactionUserRelation[0]
            const updateTxnMeta = await txn.transactionMeta.update({
                where: {
                    transactionId: result.parentTransactionId ?? result.id
                },
                data: {
                    amount: {
                        decrement: result.amount
                    },
                    totalPerson: {
                        decrement: 1
                    }
                }
            })
            await this.deleteTransactionAndRelation(txnId, txnUsrRel.userId)
            await this.settlementsService.deleteSettlements({
                transactionId: result.parentTransactionId ?? result.id
            })
            const txnsData = await this.prismaService.transactions.findMany({
                where: {
                    OR: [
                        {
                            id: result.parentTransactionId ?? result.id
                        },
                        {
                            parentTransactionId: result.parentTransactionId ?? result.id
                        }
                    ]
                },
                include: {
                    transactionUserRelation: true
                }
            })
            const settlementData = txnsData.map(item => ({
                amount: item.amount,
                userId: item.transactionUserRelation[0].userId
            }))
            await this.calculateSplitsAndUpdateOrCreateSettlements(
                updateTxnMeta.amount,
                updateTxnMeta.transactionId,
                settlementData
            )
            return {
                status: 'Successful!'
            }
        })
    }

    async deleteTransactionsById(txnId: number, userId: any): Promise<{ status: string}> {
        const txn = await this.findUniqueTransactionById(txnId)
        let parentTransactionId: number;
        if (txn) {
            parentTransactionId = txn.parentTransactionId ?? txn.id
        } else {
            throw new Error('Invalid transaction ID!')
        }
        return await this.prismaService.$transaction( async () =>{
            const result = await this.prismaService.transactions.findMany({
                where: {
                    OR: [
                        {
                            id: parentTransactionId
                        },
                        {
                            parentTransactionId: parentTransactionId
                        }
                    ]
                },
                include: {
                    transactionUserRelation: true
                }
            })
            await this.prismaService.transactionMeta.delete({
                where: {
                    transactionId: parentTransactionId
                }
            })
            await this.settlementsService.deleteSettlements({
                transactionId: parentTransactionId
            })
            for(let i = 0; i< result.length; i++){
                await this.deleteTransactionAndRelation(result[i].id, result[i].transactionUserRelation[0].userId)
            }
            return {
                status: 'Successful!'
            }
        })
    }

    private async deleteTransactionAndRelation(
        txnId: number,
        userId: string
    ) : Promise<void> {
        await this.prismaService.transactionUserRelation.delete({
            where: {
                transactionId_userId: {
                    transactionId: txnId,
                    userId: userId
                }
            }
        })
        await this.prismaService.transactions.delete({
            where: {
                id: txnId
            }
        })
    }

    async updateTransactionById(
        txnId: number,
        updateTransactionDto: UpdateTransactionDto
    ): Promise<{ status: string }> {
        return await this.prismaService.$transaction( async (txn) =>{
            const existTxn = await this.findUniqueTransactionById(txnId)
            if(!existTxn) throw new Error('Record not found!')
            const isIncrement = updateTransactionDto.amount > existTxn.amount
            const amountDiff = Math.abs(existTxn.amount - updateTransactionDto.amount)
            const parentTransactionId = existTxn.parentTransactionId ?? existTxn.id
            const newTxnMeta = await txn.transactionMeta.update({
                where: {
                    transactionId: parentTransactionId
                },
                data:{
                    amount: {
                        [isIncrement ? 'increment' : 'decrement'] : amountDiff
                    }
                }
            })
            await this.settlementsService.updateManySettlement(parentTransactionId, 0)
            await txn.transactions.update({
                where: {
                    id: txnId
                },
                data:{
                    amount: updateTransactionDto.amount
                }
            })
            const transactionData = await this.prismaService.transactions.findMany({
                where: {
                    OR: [
                        {
                            id: newTxnMeta.transactionId
                        },
                        {
                            parentTransactionId: newTxnMeta.transactionId
                        }
                    ]
                },
                select: {
                    amount: true,
                    transactionUserRelation: {
                        include: {
                            user: {
                                select: {
                                    id: true
                                }
                            }
                        }
                    }
                }
            })
            const mappedTxnData = transactionData.map(item => ({
                userId: item.transactionUserRelation[0].userId,
                amount: item.amount
            }))
            await this.calculateSplitsAndUpdateOrCreateSettlements(
                newTxnMeta.amount, 
                newTxnMeta.transactionId, 
                mappedTxnData
            )
            return {
                status: 'successful!'
            }
        })
    }
}