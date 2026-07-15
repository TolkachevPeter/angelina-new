import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

@Controller('api/contact')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @HttpCode(200)
  async create(@Body() dto: CreateLeadDto): Promise<{ ok: true; message: string; leadId: string }> {
    const lead = await this.leads.create(dto);
    return { ok: true, message: 'Lead saved', leadId: lead.id };
  }
}
