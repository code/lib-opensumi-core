import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import { AISerivceType, AiGPTBackSerivcePath } from '../common';

const aiSearchKey = '/search ';
const aiSearchCodeKey = '/searchcode ';
const aiSumiKey = '/sumi ';
const aiExplainKey = '/explain ';
const aiRunKey = '/run ';

export interface IChatMessageStructure {
  /**
   * 用于 chat 面板展示
   */
  message: string | React.ReactNode;
  /**
   * 实际调用的 prompt
   */
  prompt?: string;
}

@Injectable()
export class AiChatService {

  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  private readonly _onChatMessageLaunch = new Emitter<IChatMessageStructure>();
  public readonly onChatMessageLaunch: Event<IChatMessageStructure> = this._onChatMessageLaunch.event;

  private get currentEditor() {
    return this.editorService.currentEditor;
  }

  public launchChatMessage(data: IChatMessageStructure) {
    this._onChatMessageLaunch.fire(data);
  }

  public async switchAIService(input: string, prompt = '') {
    let type: AISerivceType | undefined;
    let message: string | undefined;

    if (!this.currentEditor) {
      return;
    }

    const currentUri = this.currentEditor.currentUri;
    if (!currentUri) {
      return;
    }

    if (input.startsWith(aiSumiKey)) {
      type = AISerivceType.Sumi;
      message = input.split(aiSumiKey)[1];

      return { type: AISerivceType.Sumi, message };
    }

    if (input.startsWith(aiExplainKey)) {
      message = input.split(aiExplainKey)[1];

      if (!prompt) {
        prompt = this.explainCodePrompt(message);
      }

      return { type: AISerivceType.Explain, message: prompt };
    }

    if (input.startsWith(aiRunKey)) {
      return { type: AISerivceType.Run, message: prompt };
    }


    if (input.startsWith(aiSearchKey)) {
      type = AISerivceType.Search;
      message = input.split(aiSearchKey)[1];
    } else if (input.startsWith(aiSearchCodeKey)) {
      type = AISerivceType.SearchCode;
      message = input.split(aiSearchCodeKey)[1];
    } else {
      type = AISerivceType.GPT;
      message = input;
    }

    return { type, message };
  }

  // 解释当前文件的代码或者选中的某个代码片段的 prompt，也可以用于对选中的代码加上用户的描述进行解释
  public explainCodePrompt(message = ''): string {
    if (!this.currentEditor) {
      return '';
    }

    const currentUri = this.currentEditor.currentUri;
    if (!currentUri) {
      return '';
    }

    const displayName = currentUri.displayName;
    const fsPath = currentUri.codeUri.fsPath;
    const content = this.currentEditor.monacoEditor.getValue();
    const selectionContent = this.currentEditor.monacoEditor.getModel()?.getValueInRange(this.currentEditor.monacoEditor.getSelection()!) || '';
    let messageWithPrompt = '';

    /**
     * 分三种情况
     * 1. 没打开任意一个文件，则提供当前文件目录树给出当前项目的解释。如果用户有 prompt，则在最后带上
     * 2. 没选中任意代码，则解释当前打开的代码文件（文件路径、代码）
     * 3. 选中任意代码，则带上当前文件信息（文件路径、代码）和选中片段
     * 4. 打开当前文件，用户如果有 prompt，则在最后带上。此时如果有选中代码片段，则带上，没有则带上文件代码
     */
    if (!this.currentEditor || !this.currentEditor.currentUri) {
      //
    }

    if (!selectionContent) {
      messageWithPrompt = `这是 ${displayName} 文件, 位置是在 ${fsPath}, 代码内容是 \`\`\`\n${content}\n\`\`\`。向我解释这个代码内容的意思`;
    }

    if (selectionContent) {
      messageWithPrompt = `这是 ${displayName} 文件, 位置是在 ${fsPath}, 代码内容是 \`\`\`\n${content}\n\`\`\`。我会给你一段代码片段，你需要给我解释这段代码片段的意思。我的代码片段是: \`\`\`\n${selectionContent}\n\`\`\` `;
    }

    if (message.trim()) {
      if (selectionContent) {
        messageWithPrompt = `这是 ${displayName} 文件，代码内容是 \`\`\`\n${content}\n\`\`\`。我会提供给你其中的某个代码片段以及我的问题, 你需要根据我给的代码片段来解释我的问题。我提供的代码片段是: \`\`\`\n${selectionContent}\n\`\`\`，我的问题是: "${message}" `;
      } else {
        messageWithPrompt = `这是 ${displayName} 文件，代码内容是 \`\`\`\n${content}\n\`\`\`。根据我提供的代码内容来回答我的问题，我的问题是: "${message}" `;
      }
    }
    return messageWithPrompt;
  }

  public async messageWithGPT(input: string) {
    const res = await this.aiBackService.aiGPTcompletionRequest(input);
    if (res.errorCode !== 0) {
      return res.errorMsg || '';
    } else {
      return res.data || '';
    }
  }
}