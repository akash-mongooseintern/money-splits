import { Transactions } from "@prisma/client"

export interface ICreateTransaction {
    amount: number,
    parentTransactionId?: number
}

export interface ICreateTransactionUserRelation {
    userId: string,
    transactionId: number
}

export interface IUserTotalPaidAndReceivedAmount {
    name: string,
    email: string,
    paid: number,
    received: number
}

interface IPersonSplitDetail {
    name: string,
    description: string
}

export interface IGetTransactionSplitsByTxnId {
    totalAmount: number,
    totalPerson: number,
    splitsInto: number,
    settlement: string[]
    details: IPersonSplitDetail[]
}

interface IUserSelect {
    firstname: string,
    lastname: string,
    email: string
}

interface IUserAndAmount {
    userId: string,
    amount: number
}

export interface ISettlementArray {
    lender: IUserAndAmount[],
    borrower: IUserAndAmount[]
}

interface ITransactionUserRelation extends ICreateTransactionUserRelation {
    user: IUserSelect
}

export interface ITransactionDataToCalculateSplit extends Transactions {
    transactionUserRelation: ITransactionUserRelation[]
}