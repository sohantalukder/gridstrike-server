import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { GuestDto } from "./dto/guest.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { AvailabilityDto } from "./dto/availability.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@ApiTags("Auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("availability")
  availability(@Query() query: AvailabilityDto) {
    return this.auth.availability(query);
  }

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post("guest")
  guest(@Body() dto: GuestDto) {
    return this.auth.guest(dto);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post("logout")
  logout(@Req() req: { headers: { authorization?: string } }) {
    const token = req.headers.authorization?.split(" ")[1] ?? "";
    return this.auth.logout(token);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.userId);
  }
}
