import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  details?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;

  /**
   * Honeypot. Real users never see or fill this; automated spam bots fill every
   * field. A non-empty value means the submission is a bot and is dropped.
   */
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'rejected' })
  website?: string;
}
