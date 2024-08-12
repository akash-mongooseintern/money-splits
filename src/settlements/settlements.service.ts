import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma";
import { ICreateSettlements } from "./settlements.interface";
import { SettlementsStatus } from "@prisma/client";

@Injectable()
export class SettlementsService{
    constructor(
        private readonly prismaService: PrismaService,
    ){}

    async getAllMySettlements(userId: string) : Promise<string[]> {
        const mySettlementData = await this.prismaService.settlements.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            {
                                lenderId: userId
                            },
                            {
                                borrowerId: userId
                            }
                        ]
                    },
                    {
                        status: SettlementsStatus.Pending
                    }
                ]
            },
            select: {
                amount: true,
                lenderId: true,
                lender: {
                    select: {
                        firstname: true,
                        lastname: true,
                    }
                },
                borrowerId: true,
                borrower: {
                    select: {
                        firstname: true,
                        lastname: true
                    }
                }
            }
        })
        const settlementMap: Map<string, {
            amount: number,
            description: string
        }> = new Map()
        for(let i = 0; i < mySettlementData.length; i++){
            if(mySettlementData[i].lenderId === userId){
                if(settlementMap.has(`${mySettlementData[i].lenderId+userId}`)){
                    const data = settlementMap.get(`${mySettlementData[i].lenderId+userId}`)
                    data && settlementMap.set(`${mySettlementData[i].lenderId+userId}`,{
                        amount:  data.amount + mySettlementData[i].amount,
                        description: `I will receive ${data.amount + mySettlementData[i].amount} rupee from ${mySettlementData[i].lender.firstname} ${mySettlementData[i].lender.lastname}`
                    })
                }else{
                    settlementMap.set(`${mySettlementData[i].lenderId+userId}`,{
                        amount: mySettlementData[i].amount,
                        description: `I will receive ${mySettlementData[i].amount} rupee from ${mySettlementData[i].lender.firstname} ${mySettlementData[i].lender.lastname}`
                    })
                }
            }
            if(mySettlementData[i].borrowerId === userId){
               if(settlementMap.has(`${mySettlementData[i].lenderId+userId}`)){
                    const data = settlementMap.get(`${mySettlementData[i].lenderId+userId}`)
                    data && settlementMap.set(`${mySettlementData[i].lenderId+userId}`,{
                        amount:  data.amount + mySettlementData[i].amount,
                        description: `I have to pay ${data.amount + mySettlementData[i].amount} rupee to ${mySettlementData[i].lender.firstname} ${mySettlementData[i].lender.lastname}`
                    })
                }else{
                    settlementMap.set(`${mySettlementData[i].lenderId+userId}`,{
                        amount: mySettlementData[i].amount,
                        description: `I have to pay ${mySettlementData[i].amount} rupee to ${mySettlementData[i].lender.firstname} ${mySettlementData[i].lender.lastname}`
                    })
                }
            }
        }
        return Array.from(settlementMap).map(item => item[1].description)
    }

    async createManySettlements(
        createManySettlements: ICreateSettlements[]
    ) : Promise<any> {
        return await this.prismaService.settlements.createMany({
            data: createManySettlements
        })
    }

    async updateSettlement(data: {
        transactionId: number,
        lenderId: string,
        borrowerId: string,
        amount: number
    }) : Promise<void> {
        await this.prismaService.settlements.upsert({
            where: {
                transactionId_lenderId_borrowerId: {
                    transactionId: data.transactionId,
                    lenderId: data.lenderId,
                    borrowerId: data.borrowerId
                }
            },
            update: {
                amount: data.amount
            },
            create: data
        })
    }

    async updateManySettlement(
        transactionId: number,
        amount: number
    ) : Promise<void> {
        await this.prismaService.settlements.updateMany({
            where: {
                transactionId: transactionId
            },
            data: {
                amount: amount
            }
        })
    }

    async deleteSettlements( data: { 
        transactionId: number; 
        lenderId?: string; 
        borrowerId?: string;
    }) : Promise<void> {
        await this.prismaService.settlements.deleteMany({
            where: data
        })
    }
}