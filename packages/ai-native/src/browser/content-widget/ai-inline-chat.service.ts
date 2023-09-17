import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event, CommandService } from '@opensumi/ide-core-common';
import { ExtensionManagementService } from '@opensumi/ide-extension/lib/browser/extension-management.service';

import { AiGPTBackSerivcePath } from '../../common/index';

export const enum EChatStatus {
  READY,
  THINKING,
  DONE,
  ERROR
}

@Injectable({ multiple: false })
export class AiInlineChatService {

  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired()
  protected extensionManagementService: ExtensionManagementService;

  private readonly _onChatStatus = new Emitter<EChatStatus>();
  public readonly onChatStatus: Event<EChatStatus> = this._onChatStatus.event;

  // 采纳
  public readonly _onAccept = new Emitter<void>();
  public readonly onAccept: Event<void> = this._onAccept.event;

  // 丢弃
  public readonly _onDiscard = new Emitter<void>();
  public readonly onDiscard: Event<void> = this._onDiscard.event;

  public launchChatMessage(message: EChatStatus) {
    setTimeout(() => {
      this._onChatStatus.fire(message);
    });
  }
}