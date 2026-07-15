import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { CreateLeadDto } from './dto/create-lead.dto';

export interface Lead {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  brand: string;
  details: string;
  language: string;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  private readonly leadsPath = process.env.LEADS_PATH ?? join(process.cwd(), 'data', 'leads.json');
  // Serializes writes so concurrent requests never interleave. The tail is kept
  // always-resolved so a single failed write can never poison future writes.
  private queue: Promise<unknown> = Promise.resolve();

  async create(dto: CreateLeadDto): Promise<Lead> {
    const lead: Lead = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      name: dto.name,
      email: dto.email,
      brand: dto.brand ?? '',
      details: dto.details ?? '',
      language: dto.language ?? 'en',
    };

    // Chain this write after the previous one, but reset the tail to a resolved
    // promise regardless of outcome so the chain never breaks.
    const run = this.queue.then(() => this.append(lead));
    this.queue = run.catch(() => undefined);

    try {
      await run;
    } catch (err) {
      this.logger.error(`Failed to persist lead ${lead.id}`, err as Error);
      throw new InternalServerErrorException('Could not save your request. Please try again.');
    }
    return lead;
  }

  private async append(lead: Lead): Promise<void> {
    const leads = await this.readAll();
    leads.push(lead);
    await fs.mkdir(dirname(this.leadsPath), { recursive: true });
    // Atomic write: write to a sibling temp file, then rename into place so a
    // crash mid-write can never leave a truncated/corrupt store.
    const tmp = `${this.leadsPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(leads, null, 2), 'utf-8');
    await fs.rename(tmp, this.leadsPath);
    this.logger.log(`Lead saved: ${lead.id} <${lead.email}>`);
  }

  private async readAll(): Promise<Lead[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.leadsPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []; // first write
      throw err; // real IO error — do NOT overwrite an existing store we failed to read
    }
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? (data as Lead[]) : [];
    } catch {
      // Existing file is not valid JSON. Preserve it (rename aside) instead of
      // silently overwriting and losing prior leads.
      const backup = `${this.leadsPath}.corrupt-${Date.now()}`;
      await fs.rename(this.leadsPath, backup).catch(() => undefined);
      this.logger.error(`Leads file was corrupt; backed up to ${backup} and starting fresh.`);
      return [];
    }
  }
}
