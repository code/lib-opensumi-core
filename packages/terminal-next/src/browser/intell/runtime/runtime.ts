// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// import speclist, {
//   diffVersionedCompletions as versionedSpeclist,
//   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//   // @ts-ignore
// } from "@withfig/autocomplete/build/index.js";
// import path from "node:path";
import { path } from '@opensumi/ide-core-common';

// import git from '@withfig/autocomplete/build/git';
// import ls from '@withfig/autocomplete/build/ls';

import suggestionBundle from './bundle.js';

import { parseCommand, CommandToken } from "./parser";
import { getArgDrivenRecommendation, getSubcommandDrivenRecommendation } from "./suggestion";
import { SuggestionBlob } from "./model";
import { resolveCwd } from "./utils";

const speclist = [
  'git', 'ls', 'cd', 'npm', 'yarn', 'docker', 'docker-compose', 'vim', 'vi', 'nano',
  'ssh', 'scp', 'curl', 'wget', 'ping', 'netstat', 'nslookup', 'dig', 'gzip', 'tar',
  'unzip', 'make', 'gcc', 'g++', 'clang', 'java', 'python', 'python3', 'pip', 'pip3',
  'virtualenv', 'node', 'nvm', 'mvn', 'gradle', 'go', 'rustc', 'cargo', 'dotnet',
  'php', 'ruby', 'gem', 'bundle', 'swift', 'kotlin', 'ansible', 'terraform',
  'azure', 'gcloud', 'kubectl', 'helm', 'vagrant', 'virtualbox', 'vmware', 'screen',
  'tmux', 'htop', 'iftop', 'top', 'ps', 'kill', 'systemctl', 'systemd', 'journalctl',
  'crontab', 'at', 'chmod', 'chown', 'rsync', 'sftp', 'ftp', 'mount', 'umount', 'df',
  'du', 'find', 'grep', 'awk', 'sed', 'cut', 'sort', 'uniq', 'cat', 'tac', 'less', 'more',
  'head', 'tail', 'diff', 'patch', 'wc', 'echo', 'printf', 'env', 'export', 'unset',
  'alias', 'unalias', 'history', 'type', 'which', 'whereis', 'whoami', 'who', 'w',
  'uptime', 'dmesg', 'uname', 'lscpu', 'lshw', 'free', 'df', 'du', 'tree', 'nc', 'socat',
  'telnet', 'openssl', 'ssh-keygen', 'gpg', 'gitlab-runner', 'travis', 'circleci',
  'jenkins', 'codeship', 'bitbucket-pipelines', 'azure-pipelines', 'github-actions',
  'firebase', 'heroku', 'now', 'vercel', 'netlify', 'surge', 's3cmd', 'rclone',
  'ansible-playbook', 'ansible-galaxy', 'ansible-vault', 'ansible-doc', 'mocha',
  'jest', 'karma', 'jasmine', 'protractor', 'cypress', 'selenium-webdriver', 'webdriverio',
  'puppeteer', 'playwright', 'storybook', 'react', 'vue', 'angular', 'svelte', 'nextjs',
  'nuxtjs', 'gatsby', 'jekyll', 'hugo', 'hexo', 'eleventy', 'markdown', 'asciidoctor',
  'pandoc', 'latex', 'groff', 'ffmpeg', 'imagemagick', 'docker', 'podman', 'buildah',
  'skaffold', 'kaniko', 'tilt', 'kind', 'minikube', 'microk8s', 'k3s', 'rkt', 'cri-o',
  // 添加更多根据个人或团队的具体需求
];


// import { Shell } from "../utils/shell.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- recursive type, setting as any
const specSet: any = {};
(speclist as string[]).forEach((s) => {
  let activeSet = specSet;
  const specRoutes = s.split("/");
  specRoutes.forEach((route, idx) => {
    if (typeof activeSet !== "object") {
      return;
    }
    if (idx === specRoutes.length - 1) {
      // const prefix = versionedSpeclist.includes(s) ? "/index.js" : `.js`;
      // HACK: 看了一下 bundle 的补全数据，这里都是 .js，为了暂先不引入 fig 的完整依赖，这里先写死了
      const prefix = `.js`;
      activeSet[route] = `@withfig/autocomplete/build/${s}${prefix}`;
    } else {
      activeSet[route] = activeSet[route] || {};
      activeSet = activeSet[route];
    }
  });
});

const loadedSpecs: { [key: string]: Fig.Spec } = {};

const loadSpec = async (cmd: CommandToken[]): Promise<Fig.Spec | undefined> => {
  const rootToken = cmd.at(0);
  if (!rootToken?.complete) {
    return;
  }

  if (loadedSpecs[rootToken.token]) {
    return loadedSpecs[rootToken.token];
  }
  if (specSet[rootToken.token]) {
    const spec = suggestionBundle[rootToken.token]
    // const spec = ls;

    loadedSpecs[rootToken.token] = spec;
    return spec;
  }
};

// this load spec function should only be used for `loadSpec` on the fly as it is cacheless
const lazyLoadSpec = async (key: string): Promise<Fig.Spec | undefined> => {
  return suggestionBundle[key];
  // return (await import(`@withfig/autocomplete/build/${key}.js`)).default;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- will be implemented in below TODO
const lazyLoadSpecLocation = async (location: Fig.SpecLocation): Promise<Fig.Spec | undefined> => {
  return; //TODO: implement spec location loading
};

export const getSuggestions = async (cmd: string, cwd: string): Promise<SuggestionBlob | undefined> => {
  const activeCmd = parseCommand(cmd);
  const rootToken = activeCmd.at(0);
  if (activeCmd.length === 0 || !rootToken?.complete) {
    return;
  }

  const spec = await loadSpec(activeCmd);
  if (spec == null) return;
  const subcommand = getSubcommand(spec);
  if (subcommand == null) return;

  const lastCommand = activeCmd.at(-1);
  const { cwd: resolvedCwd, pathy, complete: pathyComplete } = await resolveCwd(lastCommand, cwd);
  if (pathy && lastCommand) {
    lastCommand.isPath = true;
    lastCommand.isPathComplete = pathyComplete;
  }
  const result = await runSubcommand(activeCmd.slice(1), subcommand, resolvedCwd);
  if (result == null) return;

  let charactersToDrop = lastCommand?.complete ? 0 : lastCommand?.token.length ?? 0;
  if (pathy) {
    charactersToDrop = pathyComplete ? 0 : path.basename(lastCommand?.token ?? "").length;
  }
  return { ...result, charactersToDrop };
};

const getPersistentOptions = (persistentOptions: Fig.Option[], options?: Fig.Option[]) => {
  const persistentOptionNames = new Set(persistentOptions.map((o) => (typeof o.name === "string" ? [o.name] : o.name)).flat());
  return persistentOptions.concat(
    (options ?? []).filter(
      (o) => (typeof o.name == "string" ? !persistentOptionNames.has(o.name) : o.name.some((n) => !persistentOptionNames.has(n))) && o.isPersistent === true,
    ),
  );
};

// TODO: handle subcommands that are versioned
const getSubcommand = (spec?: Fig.Spec): Fig.Subcommand | undefined => {
  if (spec == null) return;
  if (typeof spec === "function") {
    const potentialSubcommand = spec();
    if (Object.prototype.hasOwnProperty.call(potentialSubcommand, "name")) {
      return potentialSubcommand as Fig.Subcommand;
    }
    return;
  }
  return spec;
};

// const executeShellCommand = buildExecuteShellCommand(5000);

const executeShellCommand = (args: any): any => {
  console.log('fake executeShellCommand', args);
}

const genSubcommand = async (command: string, parentCommand: Fig.Subcommand): Promise<Fig.Subcommand | undefined> => {
  const subcommandIdx = parentCommand.subcommands?.findIndex((s) => {
    if (Array.isArray(s.name)) {
      // 如果 s.name 是数组，检查数组中是否包含 command
      return s.name.includes(command);
    } else {
      // 如果 s.name 是字符串，直接比较
      return s.name === command;
    }
  });
  
  if (subcommandIdx == null) return;
  const subcommand = parentCommand.subcommands?.at(subcommandIdx);
  if (subcommand == null) return;

  // this pulls in the spec from the load spec and overwrites the subcommand in the parent with the loaded spec.
  // then it returns the subcommand and clears the loadSpec field so that it doesn't get called again
  switch (typeof subcommand.loadSpec) {
    case "function": {
      const partSpec = await subcommand.loadSpec(command, executeShellCommand);
      if (partSpec instanceof Array) {
        const locationSpecs = (await Promise.all(partSpec.map((s) => lazyLoadSpecLocation(s)))).filter((s) => s != null) as Fig.Spec[];
        const subcommands = locationSpecs.map((s) => getSubcommand(s)).filter((s) => s != null) as Fig.Subcommand[];
        (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = {
          ...subcommand,
          ...(subcommands.find((s) => s?.name == command) ?? []),
          loadSpec: undefined,
        };
        return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
      } else if (Object.prototype.hasOwnProperty.call(partSpec, "type")) {
        const locationSingleSpec = await lazyLoadSpecLocation(partSpec as Fig.SpecLocation);
        (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = {
          ...subcommand,
          ...(getSubcommand(locationSingleSpec) ?? []),
          loadSpec: undefined,
        };
        return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
      } else {
        (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = { ...subcommand, ...partSpec, loadSpec: undefined };
        return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
      }
    }
    case "string": {
      const spec = await lazyLoadSpec(subcommand.loadSpec as string);
      (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = { ...subcommand, ...(getSubcommand(spec) ?? []), loadSpec: undefined };
      return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
    }
    case "object": {
      (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx] = { ...subcommand, ...(subcommand.loadSpec ?? {}), loadSpec: undefined };
      return (parentCommand.subcommands as Fig.Subcommand[])[subcommandIdx];
    }
    case "undefined": {
      return subcommand;
    }
  }
};

const getOption = (activeToken: CommandToken, options: Fig.Option[]): Fig.Option | undefined => {
  return options.find((o) => (typeof o.name === "string" ? o.name === activeToken.token : o.name.includes(activeToken.token)));
};

const getPersistentTokens = (tokens: CommandToken[]): CommandToken[] => {
  return tokens.filter((t) => t.isPersistent === true);
};

const getArgs = (args: Fig.SingleOrArray<Fig.Arg> | undefined): Fig.Arg[] => {
  return args instanceof Array ? args : args != null ? [args] : [];
};

const runOption = async (
  tokens: CommandToken[],
  option: Fig.Option,
  subcommand: Fig.Subcommand,
  cwd: string,
  persistentOptions: Fig.Option[],
  acceptedTokens: CommandToken[],
): Promise<SuggestionBlob | undefined> => {
  if (tokens.length === 0) {
    throw new Error("invalid state reached, option expected but no tokens found");
  }
  const activeToken = tokens[0];
  const isPersistent = persistentOptions.some((o) => (typeof o.name === "string" ? o.name === activeToken.token : o.name.includes(activeToken.token)));
  if ((option.args instanceof Array && option.args.length > 0) || option.args != null) {
    const args = option.args instanceof Array ? option.args : [option.args];
    return runArg(tokens.slice(1), args, subcommand, cwd, persistentOptions, acceptedTokens.concat(activeToken), true, false);
  }
  return runSubcommand(tokens.slice(1), subcommand, cwd, persistentOptions, acceptedTokens.concat({ ...activeToken, isPersistent }));
};

const runArg = async (
  tokens: CommandToken[],
  args: Fig.Arg[],
  subcommand: Fig.Subcommand,
  cwd: string,
  persistentOptions: Fig.Option[],
  acceptedTokens: CommandToken[],
  fromOption: boolean,
  fromVariadic: boolean,
): Promise<SuggestionBlob | undefined> => {
  if (args.length === 0) {
    return runSubcommand(tokens, subcommand, cwd, persistentOptions, acceptedTokens, true, !fromOption);
  } else if (tokens.length === 0) {
    return await getArgDrivenRecommendation(args, subcommand, persistentOptions, undefined, acceptedTokens, fromVariadic, cwd);
  } else if (!tokens.at(0)?.complete) {
    return await getArgDrivenRecommendation(args, subcommand, persistentOptions, tokens[0], acceptedTokens, fromVariadic, cwd);
  }

  const activeToken = tokens[0];
  if (args.every((a) => a.isOptional)) {
    if (activeToken.isOption) {
      const option = getOption(activeToken, persistentOptions.concat(subcommand.options ?? []));
      if (option != null) {
        return runOption(tokens, option, subcommand, cwd, persistentOptions, acceptedTokens);
      }
      return;
    }

    const nextSubcommand = await genSubcommand(activeToken.token, subcommand);
    if (nextSubcommand != null) {
      return runSubcommand(tokens.slice(1), nextSubcommand, cwd, persistentOptions, getPersistentTokens(acceptedTokens.concat(activeToken)));
    }
  }

  const activeArg = args[0];
  if (activeArg.isVariadic) {
    return runArg(tokens.slice(1), args, subcommand, cwd, persistentOptions, acceptedTokens.concat(activeToken), fromOption, true);
  } else if (activeArg.isCommand) {
    if (tokens.length <= 0) {
      return;
    }
    const spec = await loadSpec(tokens);
    if (spec == null) return;
    const subcommand = getSubcommand(spec);
    if (subcommand == null) return;
    return runSubcommand(tokens.slice(1), subcommand, cwd);
  }
  return runArg(tokens.slice(1), args.slice(1), subcommand, cwd, persistentOptions, acceptedTokens.concat(activeToken), fromOption, false);
};

const runSubcommand = async (
  tokens: CommandToken[],
  subcommand: Fig.Subcommand,
  cwd: string,
  persistentOptions: Fig.Option[] = [],
  acceptedTokens: CommandToken[] = [],
  argsDepleted = false,
  argsUsed = false,
): Promise<SuggestionBlob | undefined> => {
  if (tokens.length === 0) {
    return getSubcommandDrivenRecommendation(subcommand, persistentOptions, undefined, argsDepleted, argsUsed, acceptedTokens, cwd);
  } else if (!tokens.at(0)?.complete) {
    return getSubcommandDrivenRecommendation(subcommand, persistentOptions, tokens[0], argsDepleted, argsUsed, acceptedTokens, cwd);
  }

  const activeToken = tokens[0];
  const activeArgsLength = subcommand.args instanceof Array ? subcommand.args.length : 1;
  const allOptions = [...persistentOptions, ...(subcommand.options ?? [])];

  if (activeToken.isOption) {
    const option = getOption(activeToken, allOptions);
    if (option != null) {
      return runOption(tokens, option, subcommand, cwd, persistentOptions, acceptedTokens);
    }
    return;
  }

  const nextSubcommand = await genSubcommand(activeToken.token, subcommand);
  if (nextSubcommand != null) {
    return runSubcommand(
      tokens.slice(1),
      nextSubcommand,
      cwd,
      getPersistentOptions(persistentOptions, subcommand.options),
      getPersistentTokens(acceptedTokens.concat(activeToken)),
    );
  }

  if (activeArgsLength <= 0) {
    return; // not subcommand or option & no args exist
  }

  const args = getArgs(subcommand.args);
  if (args.length != 0) {
    return runArg(tokens, args, subcommand, cwd, allOptions, acceptedTokens, false, false);
  }
  // if the subcommand has no args specified, fallback to the subcommand and ignore this item
  return runSubcommand(tokens.slice(1), subcommand, cwd, persistentOptions, acceptedTokens.concat(activeToken));
};
