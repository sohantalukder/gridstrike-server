import { IsOptional, IsString } from 'class-validator';

export class GuestDto {
  @IsOptional()
  @IsString()
  deviceId?: string;
}
