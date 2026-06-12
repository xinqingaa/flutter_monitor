import { Controller, Get, Inject, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { MonitorStore } from '../store/monitor-store';
import { MONITOR_STORE } from '../store/store.tokens';

@ApiTags('events')
@Controller('api/monitor/v1')
export class EventsController {
  constructor(@Inject(MONITOR_STORE) private readonly store: MonitorStore) {}

  @Get('events/:eventId')
  @ApiOperation({ summary: '按 eventId 查询 raw envelope' })
  @ApiParam({ name: 'eventId' })
  getEvent(@Param('eventId') eventId: string, @Res() res: Response): void {
    const event = this.store.getEvent(eventId);
    if (!event) {
      res.status(404).send({ error: 'event_not_found' });
      return;
    }
    res.send({ event });
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Session 下全部 raw envelope' })
  @ApiParam({ name: 'sessionId' })
  getSessionEvents(@Param('sessionId') sessionId: string) {
    const events = this.store.getSessionEvents(sessionId);
    return { sessionId, count: events.length, events };
  }

  @Get('traces/:traceId')
  @ApiOperation({ summary: 'Trace 下全部 raw envelope' })
  @ApiParam({ name: 'traceId' })
  getTraceEvents(@Param('traceId') traceId: string) {
    const events = this.store.getTraceEvents(traceId);
    return { traceId, count: events.length, events };
  }
}
