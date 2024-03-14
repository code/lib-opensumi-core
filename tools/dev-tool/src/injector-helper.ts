import { Injectable, Injector } from '@opensumi/di';
import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';
import { BrowserModule } from '@opensumi/ide-core-browser/lib/browser-module';
import { IContextKeyService } from '@opensumi/ide-core-browser/lib/context-key';
import { RecentFilesManager } from '@opensumi/ide-core-browser/lib/quick-open';
import {
  CommonServerPath,
  ConstructorOf,
  ILogServiceManager,
  ILogger,
  ILoggerManagerClient,
  LogLevel,
  LogServiceForClientPath,
  OS,
  getDebugLogger,
} from '@opensumi/ide-core-common';

import { MockLogger, MockLoggerManageClient, MockLoggerService } from '../../../packages/core-browser/__mocks__/logger';
import { useMockStorage } from '../../../packages/core-browser/__mocks__/storage';
import { MockContextKeyService } from '../../../packages/monaco/__mocks__/monaco.context-key.service';

import { MockInjector } from './mock-injector';

@Injectable()
class MockMainLayout extends BrowserModule {}

export interface MockClientApp extends ClientApp {
  injector: MockInjector;
}

export async function createBrowserApp(
  modules: Array<ConstructorOf<BrowserModule>>,
  inj?: MockInjector,
): Promise<MockClientApp> {
  const injector = inj || new MockInjector();
  // 需要依赖前后端模块
  injector.addProviders(
    {
      token: ILoggerManagerClient,
      useValue: {
        getLogger() {
          return getDebugLogger();
        },
      },
    },
    {
      token: CommonServerPath,
      useValue: {
        getBackendOS: jest.fn(() => OS.Type.OSX),
      },
    },
  );
  const app = new ClientApp({
    modules: [MockMainLayout, ...modules],
    injector,
    layoutConfig: {},
  } as any) as MockClientApp;
  await app.start(document.getElementById('main')!);
  return app;
}

@Injectable()
class MockLogServiceForClient {
  private level: LogLevel;

  hasDisposeAll = false;

  async setGlobalLogLevel(level) {
    this.level = level;
  }

  async getGlobalLogLevel() {
    return this.level;
  }
  async getLevel() {
    return this.level;
  }
  async setLevel(level: LogLevel) {
    this.level = level;
  }
  async verbose() {
    //
  }
  async debug() {}
  async warn() {}
  async log() {}
  async error() {}
  async critical() {}
  async dispose() {}
  async disposeAll() {
    this.hasDisposeAll = true;
  }
}

function getBrowserMockInjector() {
  const injector = new MockInjector();
  useMockStorage(injector);
  return injector;
}

/**
 * add mock providers for browser
 */
export function patchBrowserInjector(injector: Injector) {
  injector.addProviders(
    {
      token: IContextKeyService,
      useClass: MockContextKeyService,
    },
    {
      token: RecentFilesManager,
      useValue: {
        getMostRecentlyOpenedFiles: () => [],
      },
    },
    {
      token: LogServiceForClientPath,
      useClass: MockLogServiceForClient,
    },
    {
      token: ILoggerManagerClient,
      useClass: MockLoggerManageClient,
    },
    {
      token: ILogServiceManager,
      useClass: MockLoggerService,
    },
    {
      token: ILogger,
      useClass: MockLogger,
    },
  );
}

export function createBrowserInjector(modules: Array<ConstructorOf<BrowserModule>>, inj?: Injector): MockInjector {
  const injector = inj || getBrowserMockInjector();
  patchBrowserInjector(injector);

  const app = new ClientApp({ modules, injector } as any);
  afterAll(() => {
    app.injector.disposeAll();
  });
  return app.injector as MockInjector;
}
