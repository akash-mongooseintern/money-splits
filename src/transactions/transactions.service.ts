import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { ICreateTransaction, IGetTransactionSplitsByTxnId, ISettlementArray, ITransactionDataToCalculateSplit } from "./transactions.interface";
import { Transactions } from "@prisma/client";
import { QuickSplitsDto } from "./dto/quick-splits.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

@Injectable()
export class TransactionsService {
    constructor(
        private readonly prismaService: PrismaService
    ) { }

    async findUniqueTransactionById(id: number): Promise<Transactions | null> {
        return await this.prismaService.transactions.findUnique({ where: { id } })
    }

    async getTransactionSplitsByTxnId(
        txnId: number
    ): Promise<IGetTransactionSplitsByTxnId> {
        const txn = await this.findUniqueTransactionById(txnId)
        let parentTransactionId: number;
        if (txn) {
            parentTransactionId = txn.parentTransactionId ?? txn.id
        } else {
            throw new Error('Invalid transaction ID!')
        }
        const result = await this.prismaService.transactions.findMany({
            where: {
                OR: [
                    {
                        id: parentTransactionId,
                    },
                    {
                        parentTransactionId: parentTransactionId
                    }
                ]
            },
            include: {
                transactionUserRelation: {
                    include: {
                        user: {
                            select: {
                                firstname: true,
                                lastname: true,
                                email: true
                            }
                        }
                    }
                }
            }
        })
        const txnMeta = await this.prismaService.transactionMeta.findUnique({
            where: {
                transactionId: parentTransactionId
            }
        })
        if (!txnMeta || !result) throw new BadRequestException('Record not found! Please check transaction Id')
        return await this.calculateSplits(txnMeta.amount, txnMeta.totalPerson, result)
    }

    async calculateSplits(
        totalAmount: number,
        totalPerson: number,
        data: ITransactionDataToCalculateSplit[]
    ) : Promise<IGetTransactionSplitsByTxnId> {
        
            const res: IGetTransactionSplitsByTxnId = {
                totalAmount: totalAmount,
                totalPerson: totalPerson,
                splitsInto: totalAmount / totalPerson,
                details: [],
                settlement: []
            }
            const settlementArr: ISettlementArray = {
                lender: [],
                borrower: []
            }
            res.details = data.map((item) => {
                const { user } = item.transactionUserRelation[0]
    
                if (res.splitsInto > item.amount) {
                    settlementArr.borrower.push({
                        amount: item.amount,
                        user: item.transactionUserRelation[0].user
                    })
                } else {
                    settlementArr.lender.push({
                        amount: item.amount,
                        user: item.transactionUserRelation[0].user
                    })
                }
                return {
                    name: `${user.firstname} ${user.lastname}`,
                    description: `${user.firstname} ${user.lastname} paid ${item.amount} rupee`
                }
            })
            const { lender, borrower } = settlementArr
            let borrowerIndex = 0;
            let lenderIndex = 0;
            while (borrowerIndex < borrower.length && lenderIndex < lender.length) {
                if (borrower[borrowerIndex].amount === res.splitsInto) {
                    borrowerIndex++
                    continue
                }
                if (lender[lenderIndex].amount === res.splitsInto) {
                    lenderIndex++
                    continue
                }
                const payment = Math.min(res.splitsInto - borrower[borrowerIndex].amount, lender[lenderIndex].amount - res.splitsInto)
                borrower[borrowerIndex].amount += payment
                lender[lenderIndex].amount -= payment
                const str = `${borrower[borrowerIndex].user.firstname} ${borrower[borrowerIndex].user.lastname} will have to pay ${lender[lenderIndex].user.firstname} ${lender[lenderIndex].user.lastname} ${payment.toFixed(2)} rupees!`
                res.settlement.push(str)
            }
            res.splitsInto = +res.splitsInto.toFixed(2)
            return res
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
            await this.prismaService.transactionMeta.create({
                data: {
                    transactionId: txnData.parentTransactionId as number,
                    amount: totalAmount,
                    totalPerson: createTransactionDto.length,
                }
            })
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
            await txn.transactionMeta.update({
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
            await txn.transactionMeta.update({
                where: {
                    transactionId: existTxn.parentTransactionId ?? existTxn.id
                },
                data:{
                    amount: {
                        [isIncrement ? 'increment' : 'decrement'] : amountDiff
                    }
                }
            })
            await txn.transactions.update({
                where: {
                    id: txnId
                },
                data:{
                    amount: updateTransactionDto.amount
                }
            })
            return {
                status: 'successful!'
            }
        })
    }
}