
import { Autowired } from '@ali/common-di';
import { ClientAppContribution, CommandContribution, ContributionProvider, Domain, MonacoService, MonacoContribution, ServiceNames, MenuContribution, MenuModelRegistry, localize, KeybindingContribution, KeybindingRegistry, Keystroke, KeyCode, Key, KeySequence, KeyModifier, isOSX } from '@ali/ide-core-browser';
import { MonacoCommandService, MonacoCommandRegistry, MonacoActionRegistry } from './monaco.command.service';
import { MonacoMenus, SELECT_ALL_COMMAND } from './monaco-menu';
import { TextmateService } from './textmate.service';
import { IThemeService } from '@ali/ide-theme';
import { EditorKeybindingContexts } from '@ali/ide-editor/lib/browser/editor.keybinding.contexts';

@Domain(ClientAppContribution, MonacoContribution, CommandContribution, MenuContribution, KeybindingContribution)
export class MonacoClientContribution implements ClientAppContribution, MonacoContribution, CommandContribution, MenuContribution, KeybindingContribution {
  @Autowired()
  monacoService: MonacoService;

  @Autowired(MonacoContribution)
  contributionProvider: ContributionProvider<MonacoContribution>;

  @Autowired()
  monacoCommandService: MonacoCommandService;

  @Autowired()
  monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired()
  monacoActionRegistry: MonacoActionRegistry;

  @Autowired()
  private textmateService!: TextmateService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  private KEY_CODE_MAP = [];

  async initialize() {
    // 从 cdn 加载 monaco 和依赖的 vscode 代码
    await this.monacoService.loadMonaco();
    // 执行所有 contribution 的 onMonacoLoaded 事件，用来添加 overrideService
    for (const contribution of this.contributionProvider.getContributions()) {
      contribution.onMonacoLoaded(this.monacoService);
    }
    this.textmateService.init();
    // monaco 的 keycode 和 ide 之间的映射
    // 依赖 Monaco 加载完毕
    this.KEY_CODE_MAP = require('./monaco.keycode-map').KEY_CODE_MAP;
  }

  async onStart() {
    const currentTheme = await this.themeService.getCurrentTheme();
    const themeData = currentTheme.themeData;
    this.textmateService.setTheme(themeData);
  }

  onMonacoLoaded(monacoService: MonacoService) {
    // 该类从 vs/editor/standalone/browser/simpleServices 中获取
    const standaloneCommandService = new monaco.services.StandaloneCommandService(monaco.services.StaticServices.instantiationService.get());
    // 给 monacoCommandService 设置委托，执行 monaco 命令使用 standaloneCommandService 执行
    this.monacoCommandService.setDelegate(standaloneCommandService);
    // 替换 monaco 内部的 commandService
    monacoService.registerOverride(ServiceNames.COMMAND_SERVICE, this.monacoCommandService);
  }

  registerCommands() {
    // 注册 monaco 所有的 action
    this.monacoActionRegistry.registerMonacoActions();
  }

  registerMenus(menus: MenuModelRegistry) {
    // 注册 Monaco 的选择命令
    menus.registerSubmenu(MonacoMenus.SELECTION, localize('selection'));
    for (const group of MonacoMenus.SELECTION_GROUPS) {
      group.actions.forEach((action, index) => {
        const commandId = this.monacoCommandRegistry.validate(action);
        if (commandId) {
          const path = [...MonacoMenus.SELECTION, group.id];
          const order = index.toString();
          menus.registerMenuAction(path, { commandId, order });
        }
      });
    }
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    const monacoKeybindingsRegistry = monaco.keybindings.KeybindingsRegistry;

    // 将 Monaco 的 Keybinding 同步到 ide 中
    for (const item of monacoKeybindingsRegistry.getDefaultKeybindings()) {
      const command = this.monacoCommandRegistry.validate(item.command);
      if (command) {
        const raw = item.keybinding;

        // 转换 monaco 快捷键
        const keybindingStr = raw.parts.map((part) => this.keyCode(part)).join(' ');
        const isInDiffEditor = item.when && /(^|[^!])\bisInDiffEditor\b/gm.test(item.when.key);
        const context = isInDiffEditor
          ? EditorKeybindingContexts.diffEditorTextFocus
          : EditorKeybindingContexts.strictEditorTextFocus;
        const keybinding = { command, keybinding: keybindingStr, context };

        // 注册 keybinding
        keybindings.registerKeybinding(keybinding);
      }
    }

    // `选择全部`需要手动添加
    const selectAllCommand = this.monacoCommandRegistry.validate(SELECT_ALL_COMMAND);
    if (selectAllCommand) {
      keybindings.registerKeybinding({
        command: selectAllCommand,
        keybinding: 'ctrlcmd+a',
        context: EditorKeybindingContexts.editorTextFocus,
      });
    }
  }

  protected keyCode(keybinding: monaco.keybindings.SimpleKeybinding): KeyCode {
    const keyCode = keybinding.keyCode;
    const sequence: Keystroke = {
      /* tslint:disable-next-line: no-bitwise*/
      first: Key.getKey(this.monaco2BrowserKeyCode(keyCode & 0xff)),
      modifiers: [],
    };
    if (keybinding.ctrlKey) {
      if (isOSX) {
        sequence.modifiers!.push(KeyModifier.MacCtrl);
      } else {
        sequence.modifiers!.push(KeyModifier.CtrlCmd);
      }
    }
    if (keybinding.shiftKey) {
      sequence.modifiers!.push(KeyModifier.Shift);
    }
    if (keybinding.altKey) {
      sequence.modifiers!.push(KeyModifier.Alt);
    }
    if (keybinding.metaKey && sequence.modifiers!.indexOf(KeyModifier.CtrlCmd) === -1) {
      sequence.modifiers!.push(KeyModifier.CtrlCmd);
    }
    return KeyCode.createKeyCode(sequence);
  }

  protected keySequence(keybinding: monaco.keybindings.ChordKeybinding): KeySequence {
    return [
      this.keyCode(keybinding.firstPart),
      this.keyCode(keybinding.chordPart),
    ];
  }

  protected monaco2BrowserKeyCode(keyCode: monaco.KeyCode): number {
    for (let i = 0; i < this.KEY_CODE_MAP.length; i++) {

      if (this.KEY_CODE_MAP[i] === keyCode) {
        return i;
      }
    }
    return -1;
  }

}
