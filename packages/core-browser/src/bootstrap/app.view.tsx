import React from 'react';
import ReactDom from 'react-dom';
import { getDebugLogger, IEventBus, URI } from '@ali/ide-core-common';
import { ComponentContextProvider, IIconResourceOptions } from '@ali/ide-components';

import { ResizeEvent } from '../layout';
import { IClientApp } from '../browser-module';
import { getIcon } from '../style/icon/icon';
import { DefaultLayout } from '../components/layout/default-layout';
import { ConfigProvider, allSlot } from '../react-providers';
import { localize } from '@ali/ide-core-common';
import { LabelService } from '../services';

export interface AppProps {
  app: IClientApp;
  main: React.ComponentType;
  overlays?: React.ComponentType[];
}

export function App(props: AppProps) {
  const injector = props.app.injector;
  const eventBus: IEventBus = injector.get(IEventBus);
  const labelService: LabelService = injector.get(LabelService);
  const getResourceIcon = React.useCallback((uri: string, options: IIconResourceOptions) => {
    return labelService.getIcon(URI.parse(uri), options);
  }, []);
  React.useEffect(() => {
    let lastFrame: number | null;
    const handle = () => {
      if (lastFrame) {
        window.cancelAnimationFrame(lastFrame);
      }
      lastFrame = window.requestAnimationFrame(() => {
        lastFrame = null;
        allSlot.forEach((item) => {
          eventBus.fire(new ResizeEvent({slotLocation: item.slot}));
        });
      });
    };
    window.addEventListener('resize', handle);
    return () => { window.removeEventListener('resize', handle); };
  }, []);
  return (
    <ComponentContextProvider value={{ getIcon, localize, getResourceIcon }}>
      <ConfigProvider value={ props.app.config }>
        {<props.main />}
        {props.overlays && props.overlays.map((Component, index) => <Component key={index} />)}
      </ConfigProvider>
    </ComponentContextProvider>
  );
}

export type IAppRenderer = (app: React.ReactElement) => Promise<void>;

const defaultAppRender = (dom: HTMLElement, onDidRendered?: () => void): IAppRenderer => {
  return (app) => {
    return new Promise((resolve) => {
      ReactDom.render(app, dom, () => {
        if (onDidRendered && typeof onDidRendered === 'function') {
          onDidRendered();
        }
        resolve();
      });
    });
  };
};

export function renderClientApp(app: IClientApp, container: HTMLElement | IAppRenderer) {
  const Layout = app.config.layoutComponent || DefaultLayout;
  const overlayComponents = app.browserModules.filter((module) => module.isOverlay).map((module) => {
    if (!module.component) {
      getDebugLogger().warn('检测到空的overlay模块', module);
      return () => <></>;
    }
    return module.component;
  });

  const IdeApp = <App app={app} main={Layout} overlays={overlayComponents} />;

  const render = typeof container === 'function'
    ? container
    : defaultAppRender(container, app.config.didRendered);

  return render(IdeApp);
}
