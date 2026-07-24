import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ProfilesService } from "./profiles.service";
import { ReqUser } from "../../common/decorators/req-user.decorator";

@ApiTags("Profile")
@Controller("api/v1/profile")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly service: ProfilesService) {}

  @Get()
  me(@ReqUser() user: { userId: string }) {
    return this.service.getSelf(user.userId);
  }

  @Get(":playerId")
  player(@Param("playerId") playerId: string) {
    return this.service.getById(playerId);
  }

  @Patch()
  patch(
    @ReqUser() user: { userId: string },
    @Body() body: { displayName?: string; avatar?: string },
  ) {
    return this.service.update(user.userId, body);
  }
}
