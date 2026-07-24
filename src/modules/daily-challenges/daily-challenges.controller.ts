import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ReqUser } from "../../common/decorators/req-user.decorator";

const claimed = new Set<string>();

@ApiTags("DailyChallenges")
@Controller("api/v1/daily-challenges")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class DailyChallengesController {
  @Get("today")
  today() {
    return {
      id: "daily-001",
      description: "Capture 2 nodes without taking damage",
      rewardXp: 120,
      rewardCoins: 80,
      resetAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    };
  }

  @Post(":id/submit")
  submit(
    @Param("id") id: string,
    @ReqUser() user: { userId: string },
    @Body() body: { progress?: number },
  ) {
    return {
      ...this.today(),
      id,
      playerId: user.userId,
      submitted: body.progress ?? 0,
    };
  }

  @Post(":id/claim")
  claim(@Param("id") id: string, @ReqUser() user: { userId: string }) {
    const key = `${user.userId}:${id}`;
    if (claimed.has(key)) {
      return { claimed: false, reason: "already-claimed" };
    }
    claimed.add(key);
    return { claimed: true, reward: 100, id, playerId: user.userId };
  }
}
