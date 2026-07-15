import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Fail-fast validation of the process environment at boot. Misconfiguration
 * (a bad port, a non-URL SITE_URL) crashes the app immediately with a clear
 * message rather than surfacing as confusing runtime behaviour later.
 */
enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV?: NodeEnv;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  SITE_URL?: string;

  @IsOptional()
  @IsString()
  CONTACT_EMAIL?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  LEADS_PATH?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_TTL?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT?: number;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length > 0) {
    throw new Error(
      'Invalid environment configuration:\n' +
        errors.map((e) => '  - ' + Object.values(e.constraints ?? {}).join(', ')).join('\n'),
    );
  }
  return config;
}
