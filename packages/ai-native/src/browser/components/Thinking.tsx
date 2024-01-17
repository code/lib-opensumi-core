import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import { AiResponseTips, IAIReporter } from '../../common';
import { AiChatService } from '../ai-chat.service';
import { MsgStreamManager, EMsgStreamStatus } from '../model/msg-stream-manager';

import * as styles from './components.module.less';
import { EnhanceIcon } from './Icon';
import { Thumbs } from './Thumbs';

interface ITinkingProps {
  children?: React.ReactNode;
  status?: EMsgStreamStatus;
  message?: string;
  onRegenerate?: () => void;
  sessionId?: string;
  onStop?: () => void;
}

export const Thinking = ({ children, status, message, onStop }: ITinkingProps) => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  const handlePause = useCallback(async () => {
    aiChatService.cancelChatViewToken();
    const { currentSessionId } = msgStreamManager;
    if (currentSessionId) {
      await aiChatService.destroyStreamRequest(currentSessionId);
    }
    onStop && onStop();
  }, [msgStreamManager]);

  const renderContent = useCallback(() => {
    if (!children || (status === EMsgStreamStatus.THINKING && !message?.trim())) {
      return <span className={styles.thinking_text}>Thinking...</span>;
    }

    return children;
  }, [status, message, children]);

  return (
    <>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.thinking_container}>
        <div className={styles.stop}>
          <span className={styles.progress_bar}>
            {/* 保持动画效果一致 */}
            {(!!status || !children) && (
              <Progress loading={true} wrapperClassName={styles.ai_native_progress_wrapper} />
            )}
          </span>
          <div className={styles.block} onClick={handlePause}>
            <Icon className={getIcon('circle-pause')}></Icon>
            <span>停止</span>
          </div>
        </div>
      </div>
    </>
  );
};

export const ThinkingResult = ({ children, message, status, onRegenerate, sessionId }: ITinkingProps) => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const [latestSessionId, setLatestSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const dispose = aiChatService.onChangeSessionId((sid) => {
      setLatestSessionId(sid);
    });

    return () => dispose.dispose();
  }, [aiChatService]);

  const handleRegenerate = useCallback(() => {
    if (onRegenerate) {
      onRegenerate();
    }
  }, [onRegenerate]);

  const renderContent = useCallback(() => {
    if ((status === EMsgStreamStatus.DONE || status === EMsgStreamStatus.READY) && !message?.trim()) {
      return <span>{AiResponseTips.STOP_IMMEDIATELY}</span>;
    }

    return children;
  }, [status, message, children]);

  const isRenderRegenerate = useMemo(() => aiChatService.latestSessionId === sessionId, [sessionId, latestSessionId]);

  return (
    <>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.thinking_container}>
        <div className={styles.bottom_container}>
          <div className={styles.reset}>
            {isRenderRegenerate ? (
              <EnhanceIcon
                icon={'refresh'}
                wrapperClassName={styles.text_btn}
                className={styles.transform}
                onClick={handleRegenerate}
              >
                <span>重新生成</span>
              </EnhanceIcon>
            ) : null}
          </div>
          <div className={styles.thumbs}>
            <Thumbs relationId={sessionId} wrapperClassName={styles.icon_btn} aiReporterService={aiReporter} />
          </div>
        </div>
      </div>
    </>
  );
};