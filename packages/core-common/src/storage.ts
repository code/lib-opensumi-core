import { Autowired, Injectable } from '@opensumi/di';
import { Event, IDisposable, MaybePromise, URI } from '@opensumi/ide-utils';

import { ContributionProvider } from './contribution-provider';

export const StorageProvider = Symbol('StorageProvider');
export type StorageProvider = (storageId: URI) => Promise<IStorage>;

export const StorageResolverContribution = Symbol('StorageResolverContribution');

export interface StorageResolverContribution {
  resolve(storageId: URI): MaybePromise<void | IStorage>;
}

export interface IStorage extends IDisposable {
  readonly items: Map<string, string>;
  readonly size: number;
  readonly onDidChangeStorage: Event<string>;
  readonly whenReady: Promise<any>;

  init(storageId: string): Promise<IStorage | void>;

  get(key: string, fallbackValue: string): string;
  get(key: string, fallbackValue?: string): string | undefined;
  get<T>(key: string, fallbackValue?: T): T;

  getBoolean(key: string, fallbackValue: boolean): boolean;
  getBoolean(key: string, fallbackValue?: boolean): boolean | undefined;

  getNumber(key: string, fallbackValue: number): number;
  getNumber(key: string, fallbackValue?: number): number | undefined;

  set(key: string, value: object | string | boolean | number | undefined | null): Promise<void>;
  delete(key: string): Promise<void>;

  close(): Promise<void>;
  reConnectInit(): Promise<void>;
}

export const STORAGE_SCHEMA = {
  SCOPE: 'wsdb',
  GLOBAL: 'gldb',
};

// 在该对象定义的存储对象在初始化阶段时将默认通过 LocalStorage 缓存
// ref: https://github.com/opensumi/core/blob/f512897d691f1aa0d89ff6469ff2251ab2124f71/packages/storage/src/browser/storage.contribution.ts#L49
export const STORAGE_NAMESPACE = {
  // workspace database
  WORKBENCH: new URI('workbench').withScheme(STORAGE_SCHEMA.SCOPE),
  EXTENSIONS: new URI('extensions').withScheme(STORAGE_SCHEMA.SCOPE),
  EXPLORER: new URI('explorer').withScheme(STORAGE_SCHEMA.SCOPE),
  LAYOUT: new URI('layout').withScheme(STORAGE_SCHEMA.SCOPE),
  RECENT_DATA: new URI('recent').withScheme(STORAGE_SCHEMA.SCOPE),
  DEBUG: new URI('debug').withScheme(STORAGE_SCHEMA.SCOPE),
  OUTLINE: new URI('outline').withScheme(STORAGE_SCHEMA.SCOPE),
  CHAT: new URI('chat').withScheme(STORAGE_SCHEMA.SCOPE),
  MCP: new URI('mcp').withScheme(STORAGE_SCHEMA.SCOPE),
  // global database
  GLOBAL_LAYOUT: new URI('layout-global').withScheme(STORAGE_SCHEMA.GLOBAL),
  GLOBAL_EXTENSIONS: new URI('extensions').withScheme(STORAGE_SCHEMA.GLOBAL),
  GLOBAL_RECENT_DATA: new URI('recent').withScheme(STORAGE_SCHEMA.GLOBAL),
};

@Injectable()
export class DefaultStorageProvider {
  @Autowired(StorageResolverContribution)
  protected readonly resolversProvider: ContributionProvider<StorageResolverContribution>;

  private storageCacheMap: Map<string, IStorage> = new Map();

  /**
   * 返回对应storageId的Storage类
   */
  async get(storageId: URI): Promise<IStorage | void> {
    if (this.storageCacheMap.has(storageId.toString())) {
      return this.storageCacheMap.get(storageId.toString());
    }
    const resolvers = this.resolversProvider.getContributions();
    return Promise.race(
      resolvers.map(async (resolver) => {
        const storageResolver = await resolver.resolve(storageId);
        if (storageResolver) {
          this.storageCacheMap.set(storageId.toString(), storageResolver);
          return storageResolver;
        }
      }),
    );
  }
}

export namespace StoragePaths {
  export const WINDOWS_APP_DATA_DIR = 'AppData';
  export const WINDOWS_ROAMING_DIR = 'Roaming';
  // 可通过AppConfig配置替换，目前仅作为默认值使用
  export const DEFAULT_STORAGE_DIR_NAME = '.sumi';
  export const DEFAULT_DATA_DIR_NAME = 'datas';
  export const MARKETPLACE_DIR = 'extensions';
  export const EXTENSIONS_LOGS_DIR = 'extensions';
  export const EXTENSIONS_GLOBAL_STORAGE_DIR = 'extension-storage';
  export const EXTENSIONS_WORKSPACE_STORAGE_DIR = 'workspace-storage';
}
