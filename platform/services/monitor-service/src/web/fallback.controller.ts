import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveWebDistDir } from '../store/store.module';

@ApiExcludeController()
@Controller()
export class FallbackController {
  @Get('*')
  fallback(@Req() req: Request, @Res() res: Response): void {
    if (req.path.startsWith('/api/')) {
      res.status(404).send({ error: 'not_found' });
      return;
    }
    const webDistDir = resolveWebDistDir();
    const indexPath = join(webDistDir, 'index.html');
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }
    res.status(404).send({ error: 'not_found' });
  }
}
