export class SuccessResponseDto<T> {
    status: string;
    data: T;

    constructor(data: T, status: string = 'success'){
        this.data = data
        this.status = status
    }
}