import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { SettlementsService } from "./settlements.service";
import { AccessGuard, AuthenticatedRequest, BaseController, JwtAuthGuard } from "@Common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { SuccessResponseDto } from "../common/dto/success-response.dto";

@UseGuards(JwtAuthGuard, AccessGuard)
@ApiTags('Settlements')
@Controller('settlements')
export class SettlementsController extends BaseController {
    constructor(
        private readonly settlementsService: SettlementsService
    ){
        super()
    }

    @ApiOkResponse({
        type: Promise<SuccessResponseDto<string[]>>
    })
    @Get()
    async getAllMySettlements(
        @Req() req: AuthenticatedRequest
    ) : Promise<SuccessResponseDto<string[]>> {
        const ctx = this.getContext(req)
        return new SuccessResponseDto(await this.settlementsService.getAllMySettlements(ctx.user.id))
    }
}