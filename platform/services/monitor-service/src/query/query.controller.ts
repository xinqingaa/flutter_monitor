import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { QueryService } from './query.service';

@ApiTags('query')
@Controller('api/monitor/v1')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Get('recent')
  @ApiOperation({ summary: '最近事件 raw envelope 列表' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  recent(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.recent(query);
  }

  @Get('catalog/http')
  @ApiOperation({ summary: 'HTTP Catalog 专用分页摘要' })
  @ApiQuery({ name: 'url', required: false, description: 'URL 模糊匹配' })
  @ApiQuery({ name: 'method', required: false, description: '逗号分隔或重复参数' })
  @ApiQuery({ name: 'result', required: false, enum: ['success', 'failed', 'unknown'] })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'statusCode', required: false })
  @ApiQuery({ name: 'businessCode', required: false })
  @ApiQuery({ name: 'host', required: false })
  @ApiQuery({ name: 'slowOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  httpCatalog(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.httpCatalog(query);
  }

  @Get('dimensions')
  @ApiOperation({ summary: '维度摘要' })
  dimensions(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.dimensions(query);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Session 列表摘要' })
  sessions(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.sessions(query);
  }

  @Get('sessions/:sessionId/console')
  @ApiOperation({ summary: 'Session Console 展示摘要' })
  sessionConsole(@Param('sessionId') sessionId: string) {
    return this.queryService.sessionConsole(sessionId);
  }

  @Get('search')
  @ApiOperation({ summary: 'JSON 文本搜索' })
  @ApiQuery({ name: 'query', required: false })
  search(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.search(query);
  }

  @Get('performance/overview')
  @ApiOperation({ summary: '性能概览' })
  performanceOverview(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.performanceOverview(query);
  }

  @Get('performance/pages')
  @ApiOperation({ summary: '页面性能摘要' })
  performancePages(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.performancePages(query);
  }

  @Get('performance/http')
  @ApiOperation({ summary: 'HTTP 性能摘要' })
  performanceHttp(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.performanceHttp(query);
  }

  @Get('groups')
  @ApiOperation({ summary: '事件分组' })
  @ApiQuery({ name: 'by', required: false })
  groups(@Query() query: Record<string, string | string[] | undefined>) {
    return this.queryService.groups(query);
  }
}
