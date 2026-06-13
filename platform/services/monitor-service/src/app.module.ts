import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'node:fs';
import { EventsController } from './events/events.controller';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { IngestController } from './ingest/ingest.controller';
import { IngestService } from './ingest/ingest.service';
import { QueryController } from './query/query.controller';
import { QueryService } from './query/query.service';
import { resolvePublicDir, resolveWebDistDir, StoreModule } from './store/store.module';
import { StreamController } from './stream/stream.controller';
import { TestController } from './test/test.controller';

const webDistDir = resolveWebDistDir();
const publicDir = resolvePublicDir();
const staticRoot = existsSync(webDistDir) ? webDistDir : publicDir;

@Module({
  imports: [
    StoreModule,
    ServeStaticModule.forRoot({
      rootPath: staticRoot,
      exclude: ['/api/(.*)', '/docs', '/docs-json'],
      renderPath: '*',
    }),
  ],
  controllers: [
    IngestController,
    HealthController,
    StreamController,
    QueryController,
    EventsController,
    TestController,
  ],
  providers: [IngestService, HealthService, QueryService],
})
export class AppModule {}
