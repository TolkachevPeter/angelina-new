import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [SeoModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
