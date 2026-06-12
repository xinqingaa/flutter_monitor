import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { clampNumber } from '../query/request-filters';

@ApiTags('test')
@Controller('api/test')
export class TestController {
  @Get('slow')
  @ApiOperation({ summary: '慢请求测试端点（example api_lab）' })
  @ApiQuery({ name: 'delayMs', required: false })
  @ApiQuery({ name: 'bytes', required: false })
  slow(
    @Query('delayMs') delayMsRaw: string | undefined,
    @Query('bytes') bytesRaw: string | undefined,
    @Res() res: Response,
  ): void {
    const delayMs = clampNumber(delayMsRaw, 1000, 0, 10000);
    const bytes = clampNumber(bytesRaw, 128, 0, 1024 * 1024);
    setTimeout(() => {
      res.set('Content-Type', 'application/json');
      res.send({
        ok: true,
        delayMs,
        bytes,
        data: 'x'.repeat(bytes),
        time: new Date().toISOString(),
      });
    }, delayMs);
  }

  @Get('status/:statusCode')
  @ApiOperation({ summary: '指定 HTTP 状态码测试端点' })
  @ApiParam({ name: 'statusCode' })
  status(@Param('statusCode') statusCodeRaw: string, @Res() res: Response): void {
    const statusCode = clampNumber(statusCodeRaw, 500, 100, 599);
    res.status(statusCode).send({
      ok: statusCode >= 200 && statusCode < 400,
      statusCode,
      time: new Date().toISOString(),
    });
  }
}
