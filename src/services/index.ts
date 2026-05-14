/**
 * Service layer exports
 * All services are abstracted behind interfaces for testability and multi-platform support
 */

import { LocalFileSystemService } from './file-system.js';
import type { IFileSystemService } from './file-system.js';
import { LocalGitService } from './git.js';
import type { IGitService } from './git.js';
import { RipgrepSearchService } from './search.js';
import type { ISearchService } from './search.js';
import { DefaultWebService } from './web.js';
import type { IWebService } from './web.js';
import { LocalImageService } from './image.js';
import type { IImageService } from './image.js';
import { SecureShellService } from './shell.js';
import type { IShellService } from './shell.js';

export { LocalFileSystemService } from './file-system.js';
export type { IFileSystemService, FileInfo, DirEntry, EditOptions, ListOptions } from './file-system.js';

export { LocalGitService } from './git.js';
export type { IGitService, GitStatus, CommitInfo, DiffOptions, LogOptions, CommitOptions, BlameEntry } from './git.js';

export { RipgrepSearchService } from './search.js';
export type { ISearchService, SearchMatch, SearchOptions } from './search.js';

export { DefaultWebService } from './web.js';
export type { IWebService, WebResult } from './web.js';

export { LocalImageService } from './image.js';
export type { IImageService, ImageAnalysis } from './image.js';

export { SecureShellService } from './shell.js';
export type { IShellService, CommandResult } from './shell.js';

/**
 * Service container - provides all services for a workspace
 */
export interface ServiceContainer {
  fileSystem: IFileSystemService;
  git: IGitService;
  search: ISearchService;
  web: IWebService;
  image: IImageService;
  shell: IShellService;
}

/**
 * Create a default service container for local workspace
 */
export function createServiceContainer(cwd: string, allowedCommands?: string[], deniedCommands?: string[]): ServiceContainer {
  return {
    fileSystem: new LocalFileSystemService(cwd),
    git: new LocalGitService(cwd),
    search: new RipgrepSearchService(cwd),
    web: new DefaultWebService(),
    image: new LocalImageService(cwd),
    shell: new SecureShellService(cwd, allowedCommands, deniedCommands)
  };
}
