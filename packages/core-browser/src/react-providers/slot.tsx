import cls from 'classnames';
import React, { PropsWithChildren } from 'react';

import { Button } from '@opensumi/ide-components';
import { getDebugLogger, localize } from '@opensumi/ide-core-common';

import { LayoutConfig } from '../bootstrap';
import { IClientApp } from '../browser-module';
import { ComponentRegistry, ComponentRegistryInfo } from '../layout/layout.interface';
import { useInjectable } from '../react-hooks';

import { ConfigContext } from './config-provider';
import styles from './slot.module.less';

const logger = getDebugLogger();
export type SlotLocation = string;
export const SlotLocation = {
  top: 'top',
  view: 'view',
  extendView: 'extendView',
  main: 'main',
  statusBar: 'statusBar',
  panel: 'panel',
  extra: 'extra',
  float: 'float',
  action: 'action',
  // @deprecated ->
  bottomBar: 'bottomBar',
  bottomPanel: 'bottomPanel',
  leftBar: 'leftBar',
  leftPanel: 'leftPanel',
  rightBar: 'rightBar',
  rightPanel: 'rightPanel',
  // <- @deprecated
};

export function getSlotLocation(moduleName: string, layoutConfig: LayoutConfig) {
  if (!layoutConfig) {
    return '';
  }
  for (const location of Object.keys(layoutConfig)) {
    if (layoutConfig[location].modules && layoutConfig[location].modules.indexOf(moduleName) > -1) {
      return location;
    }
  }
  logger.warn(`Cannot find the location with ${moduleName}`);
  return '';
}

export enum TabbarContextKeys {
  activeViewlet = 'activeViewlet',
  activePanel = 'activePanel',
  activeExtendViewlet = 'activeExtendViewlet',
}

export function getTabbarCtxKey(location: string): TabbarContextKeys {
  const standardTabbarCtxKeys = {
    [SlotLocation.view]: TabbarContextKeys.activeViewlet,
    [SlotLocation.extendView]: TabbarContextKeys.activeExtendViewlet,
    [SlotLocation.panel]: TabbarContextKeys.activePanel,
  };

  return standardTabbarCtxKeys[location] || 'activeExtendViewlet';
}

export class ErrorBoundary extends React.Component<PropsWithChildren<any>> {
  state = { error: null, errorInfo: null };

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    setTimeout(() => {
      throw error; // 让上层错误抓取能捕获这个错误
    });
    logger.error(errorInfo);
  }

  update() {
    this.setState({ error: null, errorInfo: null });
  }

  render() {
    if (this.state.errorInfo) {
      return (
        <div className={styles.error_message}>
          <h2 className={styles.title}>{localize('view.component.renderedError')}</h2>
          <details className={styles.detial}>
            <div className={styles.label}>{this.state.error && (this.state.error as any).toString()}</div>
            <div className={styles.message}>{(this.state.errorInfo as any).componentStack}</div>
          </details>
          <Button onClick={() => this.update()}>{localize('view.component.tryAgain')}</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const allSlot: { slot: string; dom: HTMLElement }[] = [];

export const SlotDecorator: React.FC<{
  slot: string;
  color?: string;
  id?: string;
  children: React.ReactChild;
  className?: string;
}> = ({ slot, id, children, className }) => {
  const ref = React.useRef<HTMLElement | null>();
  React.useEffect(() => {
    if (ref.current) {
      allSlot.push({ slot, dom: ref.current });
    }
  }, [ref]);
  return (
    <div id={id} ref={(ele) => (ref.current = ele)} className={cls('resize-wrapper', className)}>
      {children}
    </div>
  );
};

export interface RendererProps {
  components: ComponentRegistryInfo[];
}
export type Renderer = React.ComponentType<RendererProps>;

export interface TabbarBehaviorConfig {
  /** 是否为后置位置（bar 在 panel 右侧或底下） */
  isLatter?: boolean;
  /** 支持的操作类型 */
  supportedActions?: {
    expand?: boolean;
    toggle?: boolean;
    accordion?: boolean;
  };
}

export class SlotRendererRegistry {
  static DefaultRenderer({ components }: RendererProps) {
    return (
      components && (
        <ErrorBoundary>
          {components.map((componentInfo, index: number) => {
            // 默认的只渲染一个
            const Component = componentInfo.views[0].component;
            if (Component) {
              return (
                <Component
                  {...(componentInfo.options && componentInfo.options.initialProps)}
                  key={`${Component.name || Component.displayName}-${index}`}
                />
              );
            }
          })}
        </ErrorBoundary>
      )
    );
  }

  protected tabbarLocation = new Set<string>();
  protected tabbarConfigs: Map<string, TabbarBehaviorConfig> = new Map();

  protected rendererRegistry: Map<string, Renderer> = new Map();

  registerSlotRenderer(slot: string, renderer: Renderer, tabbarConfig?: TabbarBehaviorConfig) {
    this.rendererRegistry.set(slot, renderer);
    if (tabbarConfig) {
      this.tabbarConfigs.set(slot, tabbarConfig);
    }
  }

  getSlotRenderer(slot: string): Renderer {
    return this.rendererRegistry.get(slot) || SlotRendererRegistry.DefaultRenderer;
  }

  addTabbar(slot: string) {
    if (!this.tabbarLocation.has(slot)) {
      this.tabbarLocation.add(slot);
    }
  }

  isTabbar(slot: string) {
    return this.tabbarLocation.has(slot);
  }

  getTabbarConfig(slot: string): TabbarBehaviorConfig | undefined {
    return this.tabbarConfigs.get(slot);
  }
}

export const slotRendererRegistry = new SlotRendererRegistry();

export interface SlotProps {
  // Slot ID
  id?: string;
  // Slot Name
  slot: string;
  // Is Tabbar or not
  isTabbar?: boolean;
  // Default Size
  defaultSize?: number;
  // Min Size
  minSize?: number;
  // Min Resize
  minResize?: number;
  // Max Resize
  maxResize?: number;
  // Z-Index
  zIndex?: number;
  // Flex
  flex?: number;
  // Flex Grow
  flexGrow?: number;
  // Others
  [key: string]: any;
}

export function SlotRenderer({ slot, isTabbar, id, ...props }: SlotProps) {
  const componentRegistry = useInjectable<ComponentRegistry>(ComponentRegistry);
  const appConfig = React.useContext(ConfigContext);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  if (isTabbar) {
    slotRendererRegistry.addTabbar(slot);
  }

  const [componentInfos, setInfos] = React.useState<ComponentRegistryInfo[]>([]);

  const prepareComponentInfos = () => {
    const componentKeys = appConfig.layoutConfig[slot]?.modules ?? [];
    const infos: ComponentRegistryInfo[] = [];
    if (!componentKeys || !componentKeys.length) {
      logger.warn(`No ${slot} view declared by location.`);
    }
    componentKeys.forEach((token) => {
      const info = componentRegistry.getComponentRegistryInfo(token);
      if (!info) {
        logger.warn(`${token} view isn't registered, please check.`);
      } else {
        infos.push(info);
      }
    });
    setInfos(infos);
  };

  React.useEffect(() => {
    // 对于嵌套在模块视图的SlotRenderer，渲染时应用已启动
    clientApp.appInitialized.promise.then(prepareComponentInfos);
  }, []);

  const Renderer = slotRendererRegistry.getSlotRenderer(slot);

  return (
    <ErrorBoundary>
      <SlotDecorator slot={slot} id={id}>
        <Renderer components={componentInfos} {...props} />
      </SlotDecorator>
    </ErrorBoundary>
  );
}

export interface SlotRendererContribution {
  registerRenderer(registry: SlotRendererRegistry): void;
}
export const SlotRendererContribution = Symbol('SlotRendererContribution');

export interface SlotRendererProps {
  Component: React.ComponentType<any> | React.ComponentType<any>[];
  initialProps?: object;
}
// @deprecated
export function ComponentRenderer({ Component, initialProps }: SlotRendererProps) {
  if (Array.isArray(Component)) {
    return (
      Component && (
        <ErrorBoundary>
          {Component.map((Component, index: number) => (
            <Component {...(initialProps || {})} key={`${Component.name}-${index}`} />
          ))}
        </ErrorBoundary>
      )
    );
  } else {
    return (
      Component && (
        <ErrorBoundary>
          <Component {...(initialProps || {})} />
        </ErrorBoundary>
      )
    );
  }
}
