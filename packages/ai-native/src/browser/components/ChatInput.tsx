import cls from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getExternalIcon } from '@opensumi/ide-core-browser';
import { Icon, Input, getIcon } from '@opensumi/ide-core-browser/lib/components';

import * as styles from './components.module.less';

interface IBlockProps {
  icon: string;
  name?: string;
}

const Block = ({ icon, name }: IBlockProps) => (
  <div className={styles.block}>
    <Icon className={icon} />
    {name && <span className={styles.name}>{name}</span>}
  </div>
);

// 指令列表
const optionsList: IBlockProps[] = [
  {
    icon: getIcon('search'),
    name: '/search ',
  },
  {
    icon: getExternalIcon('code'),
    name: '/searchCode ',
  },
  {
    icon: getIcon('edit'),
    name: '/explain ',
  },
  {
    icon: getIcon('smile'),
    name: '/sumi ',
  },
];

// 指令命令激活组件
const InstructionOptions = ({ onClick, bottom }) => {
  const [commonlyUsed, setCommonlyUsed] = useState<IBlockProps[]>([]);
  const [options, setOptions] = useState<IBlockProps[]>([]);

  useEffect(() => {
    setOptions(optionsList);

    setCommonlyUsed([
      {
        icon: getIcon('delete'),
        name: '聊天',
      },
    ]);
  }, []);

  const handleClick = useCallback(
    (name: string | undefined) => {
      if (onClick) {
        onClick(name || '');
      }
    },
    [onClick],
  );

  return (
    <div className={styles.instruction_options_container} style={{ bottom: bottom + 'px' }}>
      <div className={styles.options}>
        <ul>
          {options.map(({ icon, name }) => (
            <li key={name} onClick={() => handleClick(name)}>
              <Block icon={icon} />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </div>
      {commonlyUsed.length > 0 && (
        <div className={styles.commonly_used}>
          <span>常用指令：</span>
          {commonlyUsed.map(({ icon, name }, i) => (
            <Block key={i} icon={icon} name={name} />
          ))}
        </div>
      )}
    </div>
  );
};

export interface IChatInputProps {
  onSend: (value: string) => void;
}

// 指令命令激活组件
export const ChatInput = ({ onSend }: IChatInputProps) => {
  const [value, setValue] = useState('');
  const [isShowOptions, setIsShowOptions] = useState<boolean>(false);
  const [wrapperHeight, setWrapperHeight] = useState<number>(40);
  const [slashWidget, setSlashWidget] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (value.length === 1 && value.startsWith('/')) {
      setIsShowOptions(true);
    } else {
      setIsShowOptions(false);
    }

    // 自适应高度
    if (inputRef && inputRef.current) {
      inputRef.current.style.height = 0 + 'px';

      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = Math.min(scrollHeight, 140) + 'px';

      setWrapperHeight(scrollHeight + 20);
    }

    // 设置 slash widget 块
    const regex = /\/(\w+)\s/;
    const match = value.match(regex);
    if (match) {
      const keyword = match[0];
      if (optionsList.find(({ name }) => name === keyword)) {
        setSlashWidget(keyword);
      }
    } else {
      setSlashWidget('');
    }
  }, [inputRef, value]);

  const handleInputChange = useCallback((value: string) => setValue(value), []);

  const handleSend = useCallback(() => {
    if (onSend) {
      onSend(value);
      setValue('');
    }
  }, [onSend, value]);

  const acquireOptionsCheck = useCallback(
    (value: string) => {
      if (value) {
        setValue(value);
        setIsShowOptions(false);

        if (inputRef && inputRef.current) {
          inputRef.current.focus();
        }
      }
    },
    [inputRef],
  );

  const optionsBottomPosition = useMemo(() => Math.min(181, Math.max(61, 21 + wrapperHeight)), [wrapperHeight]);

  return (
    <div className={styles.chat_input_container}>
      {isShowOptions && <InstructionOptions onClick={acquireOptionsCheck} bottom={optionsBottomPosition} />}
      <div className={styles.header_operate}>
        <Block icon={getIcon('add-comments')} name={'新对话'} />
        <Icon className={getExternalIcon('history')} />
      </div>
      <Input
        ref={inputRef}
        placeholder={'可以问我任何问题，或键入主题 "/"'}
        wrapperStyle={{ height: wrapperHeight + 'px' }}
        value={value}
        type={'textarea'}
        onValueChange={handleInputChange}
        className={styles.input_wrapper}
        // onPressEnter={() => handleSend()}
        addonBefore={
          slashWidget && (
            <div className={styles.slash_widget_block}>
              <span>{slashWidget}</span>
            </div>
          )
        }
        addonAfter={
          <div className={cls(styles.send_chat_btn, value.length && styles.active)} onClick={() => handleSend()}>
            <Icon className={getIcon('right')} />
          </div>
        }
      />
    </div>
  );
};