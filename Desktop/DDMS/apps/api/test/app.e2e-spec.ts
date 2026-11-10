import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { NotificationsService } from './../src/application/notifications/notifications.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NotificationsService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'ddms-api' });
  });

  it('rejects unauthenticated access to the current-user endpoint', () => {
    return request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('rejects unauthenticated access to role applications and notifications', async () => {
    await request(app.getHttpServer())
      .get('/api/role-applications')
      .expect(401);
    await request(app.getHttpServer()).get('/api/notifications').expect(401);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
