import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IngestService } from './ingest.service';

@ApiTags('ingest')
@Controller('api/monitor/v1')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post('events')
  @ApiOperation({ summary: '接收单条或批量 EventEnvelope' })
  @ApiBody({
    schema: {
      oneOf: [
        { type: 'object', additionalProperties: true },
        {
          type: 'object',
          properties: { events: { type: 'array', items: { type: 'object' } } },
        },
      ],
    },
  })
  @ApiResponse({ status: 202, description: '部分或全部事件已接受' })
  @ApiResponse({ status: 400, description: 'no_events 或 missing_event_id' })
  ingestEvents(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const result = this.ingestService.ingest(body);
    res.status(result.status);
    return result.body;
  }
}
