import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ContextKeyChangeEvent, Event, WithEventBus, View, ViewContainerOptions, ContributionProvider, SlotLocation, IContextKeyService, ExtensionActivateEvent, IContextKey } from '@ali/ide-core-browser';
import { MainLayoutContribution, IMainLayoutService } from '../common';
import { TabBarHandler } from './tabbar-handler';
import { TabbarService } from './tabbar/tabbar.service';
import { IMenuRegistry, AbstractContextMenuService, MenuId, AbstractMenuService, IContextMenu } from '@ali/ide-core-browser/lib/menu/next';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';
import './main-layout.less';
import { AccordionService } from './accordion/accordion.service';
import debounce = require('lodash.debounce');

@Injectable()
export class LayoutService extends WithEventBus implements IMainLayoutService {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

  @Autowired(IMenuRegistry)
  menus: IMenuRegistry;

  @Autowired()
  private layoutState: LayoutState;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  private handleMap: Map<string, TabBarHandler> = new Map();

  private services: Map<string, TabbarService> = new Map();

  private accordionServices: Map<string, AccordionService> = new Map();

  private pendingViewsMap: Map<string, {view: View, props?: any}[]> = new Map();

  private viewToContainerMap: Map<string, string> = new Map();

  private state: {[location: string]: {
    currentId?: string;
    size?: number;
  }} = {};

  private viewWhenContextkeys = new Set<string>();
  private customViewSet = new Set<View>();
  private allViews = new Map<string, View>();
  private forceRevealContextKeys = new Map<string, {when: string; key: IContextKey<boolean>}>();

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(AbstractContextMenuService)
  protected contextmenuService: AbstractContextMenuService;

  constructor() {
    super();
  }

  didMount() {
    for (const [containerId, views] of this.pendingViewsMap.entries()) {
      views.forEach(({view, props}) => {
        this.collectViewComponent(view, containerId, props);
      });
    }
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidRender) {
        contribution.onDidRender();
      }
    }
    this.restoreState();
    this.addDispose(Event.debounce<ContextKeyChangeEvent, boolean>(
      this.contextKeyService.onDidChangeContext,
      (last, event) =>  last || event.payload.affectsSome(this.viewWhenContextkeys),
      50,
    )((e) => e && this.handleContextKeyChange(), this));
  }

  setFloatSize(size: number) {}

  storeState(service: TabbarService, currentId: string) {
    this.state[service.location] = {
      currentId,
      size: service.prevSize,
    };
    this.layoutState.setState(LAYOUT_STATE.MAIN, this.state);
  }

  restoreState() {
    this.state = this.layoutState.getState(LAYOUT_STATE.MAIN, {
      [SlotLocation.left]: {
        currentId: undefined,
        size: undefined,
      },
      [SlotLocation.right]: {
        currentId: '',
        size: undefined,
      },
      [SlotLocation.bottom]: {
        currentId: undefined,
        size: undefined,
      },
    });
    for (const service of this.services.values()) {
      const {currentId, size} = this.state[service.location] || {};
      service.prevSize = size;
      service.currentContainerId = currentId !== undefined ? (service.containersMap.has(currentId) ? currentId : '') : service.visibleContainers[0].options!.containerId;
    }
  }

  isVisible(location: string) {
    const tabbarService = this.getTabbarService(location);
    return !!tabbarService.currentContainerId;
  }

  toggleSlot(location: string, show?: boolean | undefined, size?: number | undefined): void {
    const tabbarService = this.getTabbarService(location);
    if (!tabbarService) {
      // tslint:disable-next-line no-console
      console.error(`没有找到${location}对应位置的TabbarService，无法切换面板`);
      return;
    }
    if (show === true) {
      tabbarService.currentContainerId = tabbarService.currentContainerId || tabbarService.previousContainerId || tabbarService.containersMap.keys().next().value;
    } else if (show === false) {
      tabbarService.currentContainerId = '';
    } else {
      tabbarService.currentContainerId = tabbarService.currentContainerId ? '' : tabbarService.previousContainerId || tabbarService.containersMap.keys().next().value;
    }
    if (tabbarService.currentContainerId && size) {
      tabbarService.resizeHandle.setSize(size);
    }
  }

  // TODO: noAccordion应该由视图决定，service不需要关心
  getTabbarService(location: string, noAccordion?: boolean) {
    const service = this.services.get(location) || this.injector.get(TabbarService, [location, noAccordion]);
    if (!this.services.get(location)) {
      service.onCurrentChange(({currentId}) => {
        this.storeState(service, currentId);
        if (currentId && !service.noAccordion) {
          const accordionService = this.getAccordionService(currentId);
          accordionService.expandedViews.forEach((view) => {
            this.eventBus.fire(new ExtensionActivateEvent({ topic: `onView:${view.id}` }));
          });
        }
      });
      service.onSizeChange(() => debounce(() => this.storeState(service, service.currentContainerId), 200)());
      this.services.set(location, service);
    }
    return service;
  }

  getAccordionService(containerId: string, noRestore?: boolean) {
    let service = this.accordionServices.get(containerId);
    if (!service) {
      service = this.injector.get(AccordionService, [containerId, noRestore]);
      this.accordionServices.set(containerId, service);
    }
    return service;
  }

  getTabbarHandler(viewOrContainerId: string): TabBarHandler | undefined {
    let handler = this.doGetTabbarHandler(viewOrContainerId);
    if (!handler) {
      const containerId = this.viewToContainerMap.get(viewOrContainerId);
      if (!containerId) {
        // tslint:disable-next-line no-console
        console.warn(`没有找到${viewOrContainerId}对应的tabbar！`);
      }
      handler = this.doGetTabbarHandler(containerId || '');
    }
    return handler;
  }

  getExtraMenu(): IContextMenu {
    return this.contextmenuService.createMenu({
      id: MenuId.ActivityBarExtra,
    });
  }

  protected doGetTabbarHandler(containerId: string) {
    let activityHandler = this.handleMap.get(containerId);
    if (!activityHandler) {
      let location: string | undefined;
      for (const service of this.services.values()) {
        if (service.getContainer(containerId)) {
          location = service.location;
          break;
        }
      }
      if (location) {
        activityHandler = this.injector.get(TabBarHandler, [containerId, this.getTabbarService(location)]);
        this.handleMap.set(containerId, activityHandler);
      }
    }
    return activityHandler;
  }

  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string, Fc?: any): string {
    if (Fc) {
      // tslint:disable-next-line no-console
      console.warn('collectTabbarComponent api warning: Please move react component into options.component!');
    }
    const tabbarService = this.getTabbarService(side);
    tabbarService.registerContainer(options.containerId, {views, options});
    views.forEach((view) => {
      this.viewToContainerMap.set(view.id, options.containerId);
    });
    return options.containerId;
  }

  collectViewComponent(view: View, containerId: string, props?: any): string {
    this.allViews.set(view.id, view);
    this.viewToContainerMap.set(view.id, containerId);
    if (view.when) {
      // 强制显示的contextKey
      const forceRevealExpr = this.createRevealContextKey(view.id);
      this.fillKeysInWhenExpr(this.viewWhenContextkeys, view.when);
      this.customViewSet.add(view);
      if (!this.contextKeyService.match(view.when) && !this.contextKeyService.match(forceRevealExpr)) {
        return containerId;
      }
    }
    const accordionService: AccordionService = this.getAccordionService(containerId);
    if (props) {
      view.initialProps = props;
    }
    accordionService.appendView(view);
    return containerId;
  }

  replaceViewComponent(view: View, props?: any) {
    const containerId = this.viewToContainerMap.get(view.id);
    if (!containerId) {
      // tslint:disable-next-line no-console
      console.warn(`没有找到${view.id}对应的容器，请检查传入参数!`);
      return;
    }
    const contributedView = this.allViews.get(view.id);
    if (contributedView) {
      view = Object.assign(contributedView, view);
    }

    this.collectViewComponent(view, containerId!, props);
  }

  disposeViewComponent(viewId: string) {
    const containerId = this.viewToContainerMap.get(viewId);
    if (!containerId) {
      // tslint:disable-next-line no-console
      console.warn(`没有找到${viewId}对应的容器，请检查传入参数!`);
      return;
    }
    const accordionService: AccordionService = this.getAccordionService(containerId);
    accordionService.disposeView(viewId);
  }

  revealView(viewId: string) {
    const target = this.forceRevealContextKeys.get(viewId);
    if (target) {
      target.key.set(true);
    }
  }

  disposeContainer(containerId: string) {
    let location: string | undefined;
    for (const service of this.services.values()) {
      if (service.getContainer(containerId)) {
        location = service.location;
        break;
      }
    }
    if (location) {
      const tabbarService = this.getTabbarService(location);
      tabbarService.disposeContainer(containerId);
    } else {
      // tslint:disable-next-line no-console
      console.warn('没有找到containerId所属Tabbar!');
    }
  }

  // TODO 这样很耦合，不能做到tab renderer自由拆分
  expandBottom(expand: boolean): void {
    const tabbarService = this.getTabbarService(SlotLocation.bottom);
    tabbarService.doExpand(expand);
    this.contextKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
  }

  get bottomExpanded(): boolean {
    const tabbarService = this.getTabbarService(SlotLocation.bottom);
    this.contextKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
    return tabbarService.isExpanded;
  }

  private createRevealContextKey(viewId: string) {
    const forceRevealKey = `forceShow.${viewId}`;
    this.forceRevealContextKeys.set(viewId, {
      when: `${forceRevealKey} == true`,
      key: this.contextKeyService.createKey(forceRevealKey, false),
    });
    this.viewWhenContextkeys.add(forceRevealKey);
    return `${forceRevealKey} == true`;
  }

  private handleContextKeyChange() {
    this.customViewSet.forEach((view) => {
      const targetContainerId = this.viewToContainerMap.get(view.id)!;
      if (this.contextKeyService.match(view.when) || this.contextKeyService.match(this.forceRevealContextKeys.get(view.id)!.when)) {
        this.collectViewComponent(view, targetContainerId);
      }
    });
  }

  private fillKeysInWhenExpr(set: Set<string>, when?: string) {
    const keys = this.contextKeyService.getKeysInWhen(when);
    keys.forEach((key) => {
      set.add(key);
    });
  }
}
