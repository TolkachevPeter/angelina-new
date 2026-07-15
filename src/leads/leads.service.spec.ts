import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  let leadsPath: string;
  let service: LeadsService;

  beforeEach(() => {
    leadsPath = join(tmpdir(), `leads-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    process.env.LEADS_PATH = leadsPath;
    service = new LeadsService();
  });

  afterEach(async () => {
    await fs.rm(leadsPath, { force: true });
    delete process.env.LEADS_PATH;
  });

  it('persists a lead with generated id, timestamp and defaults', async () => {
    const lead = await service.create({ name: 'Jane', email: 'jane@example.com' });
    expect(lead.id).toBeTruthy();
    expect(lead.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(lead.brand).toBe('');
    expect(lead.language).toBe('en');

    const saved = JSON.parse(await fs.readFile(leadsPath, 'utf-8'));
    expect(saved).toHaveLength(1);
    expect(saved[0].email).toBe('jane@example.com');
  });

  it('appends and serializes concurrent writes without corruption', async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        service.create({ name: `User ${i}`, email: `u${i}@example.com` }),
      ),
    );
    const saved = JSON.parse(await fs.readFile(leadsPath, 'utf-8'));
    expect(saved).toHaveLength(8);
    const emails = saved.map((l: { email: string }) => l.email).sort();
    expect(new Set(emails).size).toBe(8);
  });

  it('does not overwrite a corrupt store — backs it up and continues', async () => {
    await fs.mkdir(require('path').dirname(leadsPath), { recursive: true });
    await fs.writeFile(leadsPath, '{ this is not valid json ]', 'utf-8');
    const lead = await service.create({ name: 'Jane', email: 'jane@example.com' });
    expect(lead.id).toBeTruthy();
    const saved = JSON.parse(await fs.readFile(leadsPath, 'utf-8'));
    expect(saved).toHaveLength(1);
    // The corrupt original was preserved as a backup, not destroyed.
    const dir = require('path').dirname(leadsPath);
    const backups = (await fs.readdir(dir)).filter((f) => f.includes('.corrupt-'));
    expect(backups.length).toBeGreaterThan(0);
    await Promise.all(backups.map((b) => fs.rm(join(dir, b), { force: true })));
  });

  it('recovers from a non-array JSON store instead of crashing', async () => {
    await fs.mkdir(require('path').dirname(leadsPath), { recursive: true });
    await fs.writeFile(leadsPath, '{"not":"an array"}', 'utf-8');
    const lead = await service.create({ name: 'Bob', email: 'bob@example.com' });
    expect(lead.email).toBe('bob@example.com');
    const saved = JSON.parse(await fs.readFile(leadsPath, 'utf-8'));
    expect(Array.isArray(saved)).toBe(true);
    expect(saved).toHaveLength(1);
  });
});
