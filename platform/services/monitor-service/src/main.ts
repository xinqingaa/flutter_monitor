import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const port = Number.parseInt(process.env.PORT || '3700', 10);
  const bodyLimit = process.env.FM_WORKBENCH_BODY_LIMIT || '10mb';

  app.enableCors();
  app.use(json({ limit: bodyLimit }));
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof SyntaxError) {
      res.status(400).send({ error: 'invalid_json' });
      return;
    }
    next(error);
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Flutter Monitor Service')
    .setDescription('Monitor Service API：ingest、query、SSE 与 test helpers')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
  app.use('/docs-json', (_req: Request, res: Response) => {
    res.json(document);
  });

  await app.listen(port, '0.0.0.0');

  const sqlitePath = process.env.FM_WORKBENCH_SQLITE_PATH || '(default platform/.data/events.sqlite)';
  console.log(`Flutter Monitor service listening at http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
  console.log(`SQLite store: ${sqlitePath}`);
  console.log('POST /api/monitor/v1/events');
  console.log('GET  /api/monitor/v1/health');
  console.log('GET  /api/monitor/v1/stream');
  console.log('GET  /api/monitor/v1/sessions?userId=&from=&to=');
  console.log('GET  /api/monitor/v1/performance/overview');
  console.log('GET  /api/monitor/v1/catalog/http');
  console.log('GET  /api/monitor/v1/catalog/business');
  console.log('GET  /api/monitor/v1/catalog/errors');
  console.log('GET  /api/monitor/v1/events/:eventId');
  console.log('GET  /api/monitor/v1/sessions/:sessionId');
  console.log('GET  /api/monitor/v1/traces/:traceId');

  const shutdown = async () => {
    try {
      await app.close();
    } catch (error) {
      console.error('Flutter Monitor service shutdown failed.', error);
      process.exit(1);
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    const port = process.env.PORT || '3700';
    console.error(`Flutter Monitor service could not start because port ${port} is already in use.`);
    console.error('Run "bash scripts/platform.sh stop" or set FM_SERVER_PORT to another port.');
    process.exit(1);
  }
  throw error;
});
