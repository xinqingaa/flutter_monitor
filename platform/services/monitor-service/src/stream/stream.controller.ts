import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SseHub } from '../stream/sse-hub';
import { SSE_HUB } from '../store/store.tokens';

@ApiTags('stream')
@Controller('api/monitor/v1')
export class StreamController {
  constructor(@Inject(SSE_HUB) private readonly sseHub: SseHub) {}

  @Get('stream')
  @ApiOperation({ summary: 'SSE 实时事件流' })
  stream(@Res() res: Response): void {
    this.sseHub.connect(res);
  }
}
