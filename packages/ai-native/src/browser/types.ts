import React from 'react';

import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { CancellationToken, MaybePromise, IDisposable, Deferred } from '@opensumi/ide-core-common';
import { CompletionResultModel, IAiBackService } from '@opensumi/ide-core-common/lib/ai-native';
import { IEditor } from '@opensumi/ide-editor/lib/browser';
import { NewSymbolNamesProvider } from '@opensumi/ide-monaco';
import type * as monaco from '@opensumi/ide-monaco';

import { CompletionRequestBean } from './inline-completions/model/competionModel';

export class ReplyResponse {
  constructor(readonly message: string) {}
}

export class ErrorResponse {
  constructor(readonly error: any, readonly message?: string) {}

  static is(response: any): boolean {
    return response instanceof ErrorResponse || (typeof response === 'object' && response.error !== undefined);
  }
}

export class CancelResponse {
  readonly cancellation: boolean = true;

  constructor(readonly message?: string) {}

  static is(response: any): boolean {
    return response instanceof CancelResponse || (typeof response === 'object' && response.cancellation !== undefined);
  }
}

export interface InlineChatHandler {
  /**
   * 直接执行 action 的操作，点击后 inline chat 立即消失
   */
  execute?: (editor: IEditor) => MaybePromise<void>;
  /**
   * 提供 diff editor 的预览策略
   */
  providerDiffPreviewStrategy?: (
    editor: IEditor,
    cancelToken: CancellationToken,
  ) => MaybePromise<ReplyResponse | ErrorResponse | CancelResponse>;
}

export const IInlineChatFeatureRegistry = Symbol('IInlineChatFeatureRegistry');

export interface IInlineChatFeatureRegistry {
  registerInlineChat(operational: AIActionItem, handler: InlineChatHandler): void;
}

export type AiRunHandler = () => MaybePromise<void>;
export interface IAiRunAnswerComponentProps {
  input: { data: string };
  relationId: string;
}

export const IAiRunFeatureRegistry = Symbol('IAiRunFeatureRegistry');

export interface IAiRunFeatureRegistry {
  /**
   * 注册 run 运行的能力
   */
  registerRun(handler: AiRunHandler): void;
  /**
   * 返回 answer 时渲染的组件
   */
  registerAnswerComponent(component: React.FC<IAiRunAnswerComponentProps>): void;

  registerRequest(request: IAiBackService['request']): void;

  registerStreamRequest(streamRequest: IAiBackService['requestStream']): void;

  getRuns(): AiRunHandler[];

  getAnswerComponent(): React.FC<IAiRunAnswerComponentProps> | undefined;

  getRequest(): IAiBackService['request'];

  getStreamRequest(): IAiBackService['requestStream'];
}

export const AiNativeCoreContribution = Symbol('AiNativeCoreContribution');

export type IProvideInlineCompletionsSignature = (
  this: void,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  token: CancellationToken,
  next: (reqBean: CompletionRequestBean) => MaybePromise<CompletionResultModel | null>,
  completionRequestBean: CompletionRequestBean,
) => MaybePromise<CompletionResultModel | null>;

export interface IAiMiddleware {
  language?: {
    provideInlineCompletions?: IProvideInlineCompletionsSignature;
  };
}

export type NewSymbolNamesProviderFn = NewSymbolNamesProvider['provideNewSymbolNames'];

export interface IRenameCandidatesProviderRegistry {
  registerRenameSuggestionsProvider(provider: NewSymbolNamesProviderFn): void;
  getRenameSuggestionsProviders(): NewSymbolNamesProviderFn[];
}

export interface AiNativeCoreContribution {
  /**
   * 注册 ai run 的能力
   * @param registry
   */
  registerRunFeature?(registry: IAiRunFeatureRegistry): void;
  /**
   * 注册 inline chat
   * @param registry
   */
  registerInlineChatFeature?(registry: IInlineChatFeatureRegistry): void;
  /**
   * 通过中间件扩展部分 ai 能力
   */
  middleware?: IAiMiddleware;

  registerRenameProvider?(registry: IRenameCandidatesProviderRegistry): void;
}

export interface IChatComponentConfig {
  id: string;
  component: React.ComponentType<Record<string, unknown>>;
  initialProps: Record<string, unknown>;
}

export const IChatAgentViewService = Symbol('IChatAgentViewService');

export interface IChatAgentViewService {
  registerChatComponent(component: IChatComponentConfig): IDisposable;
  getChatComponent(componentId: string): IChatComponentConfig | null;
  getChatComponentDeferred(componentId: string): Deferred<IChatComponentConfig> | null;
}
