import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitGameResultDto {
  @IsString()
  @IsOptional()
  resultId?: string;

  @IsString()
  @IsIn(['practice', 'survival', 'missions', 'dailyChallenge'])
  mode!: 'practice' | 'survival' | 'missions' | 'dailyChallenge';

  @IsInt()
  @Min(0)
  score!: number;

  @IsInt()
  @Min(0)
  @Max(5000)
  kills!: number;

  @IsInt()
  @Min(0)
  @Max(3_600)
  durationSeconds!: number;

  @IsInt()
  @Min(0)
  @Max(12)
  nodesCaptured!: number;

  @IsNumber()
  @Min(0)
  damageTaken!: number;

  @IsString()
  @IsIn(['victory', 'defeat'])
  status!: 'victory' | 'defeat';

  @IsInt()
  @Min(0)
  coins!: number;

  @IsInt()
  @Min(0)
  experience!: number;

  @IsOptional()
  @IsString()
  missionId?: string;

  @IsOptional()
  @IsString()
  dailyChallengeId?: string;
}
